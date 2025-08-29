
import { pipeline, env } from '@huggingface/transformers';
import faqs from "@/faq.json";

import {
  FilesetResolver,
  LlmInference,
} from "@mediapipe/tasks-genai";

const model = "Xenova/all-MiniLM-L6-v2";
env.allowLocalModels = false;

// MediaPipe LLM Inference instance
let llmInference = null;
let mediaPipeInitialized = false;

// Initialize MediaPipe LLM Inference
const initializeMediaPipe = async () => {
  if (mediaPipeInitialized) return true;
  
  try {
    const genai = await FilesetResolver.forGenAiTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm"
    );
    
    llmInference = await LlmInference.createFromOptions(genai, {
      baseOptions: {
        modelAssetPath: '/gemma3-1B-it-int4.task'
      }
    });
    
    mediaPipeInitialized = true;
    return true;
  } catch (error) {
    console.error('MediaPipe initialization failed:', error);
    return false;
  }
};

// Function to check Prompt API availability and return status
const checkPromptAPIAvailability = async () => {
  // Check if Chrome Prompt API is available
  if (typeof LanguageModel === 'undefined') {
    // Try to initialize MediaPipe as fallback
    const mediaPipeSuccess = await initializeMediaPipe();
    return {
      available: false,
      message: mediaPipeSuccess ? 'Using MediaPipe Gemma-3 1B (local)' : 'No AI available',
      instructions: mediaPipeSuccess ? 'Local AI model loaded successfully' : 'Both Prompt API and MediaPipe unavailable'
    };
  }

  try {
    // Check availability
    const available = await LanguageModel.availability();
    if (available === 'unavailable') {
      // Try to initialize MediaPipe as fallback
      const mediaPipeSuccess = await initializeMediaPipe();
      return {
        available: false,
        message: mediaPipeSuccess ? 'Using MediaPipe Gemma-3 1B (local)' : 'No AI available',
        instructions: mediaPipeSuccess ? 'Local AI model loaded successfully' : 'Both Prompt API and MediaPipe unavailable'
      };
    }
    
    return {
      available: true,
      message: 'Using Prompt API',
      instructions: 'Enhanced AI responses enabled'
    };
  } catch (error) {
    // Try to initialize MediaPipe as fallback
    const mediaPipeSuccess = await initializeMediaPipe();
    return {
      available: false,
      message: mediaPipeSuccess ? 'Using MediaPipe Gemma-3 1B (local)' : 'No AI available',
      instructions: mediaPipeSuccess ? 'Local AI model loaded successfully' : 'Both Prompt API and MediaPipe unavailable'
    };
  }
};

// Helper function to calculate cosine similarity between two vectors
const cosineSimilarity = (vecA, vecB) => {
  // Input validation
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
    return 0;
  }
  
  if (vecA.length !== vecB.length) {
    return 0;
  }
  
  if (vecA.length === 0) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  // Calculate dot product and norms
  for (let i = 0; i < vecA.length; i++) {
    const valA = Number(vecA[i]) || 0;
    const valB = Number(vecB[i]) || 0;
    
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  
  // Handle edge cases for very small numbers
  if (normA < 1e-10 || normB < 1e-10) {
    return 0;
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  // Final validation
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  const similarity = dotProduct / (normA * normB);
  
  // Ensure result is within valid range and handle NaN/Infinity
  if (isNaN(similarity) || !isFinite(similarity)) {
    return 0;
  }
  
  // Clamp to [-1, 1] range for numerical stability
  return Math.max(-1, Math.min(1, similarity));
};

// AI Response generation using Prompt API or MediaPipe fallback
const generateAIResponse = async (question, faqResults, chatHistory) => {
  // Try Chrome Prompt API first
  if (typeof LanguageModel !== 'undefined') {
    try {
      const available = await LanguageModel.availability();
      if (available === 'available') {
        return await usePromptAPI(question, faqResults, chatHistory);
      }
    } catch (error) {
      console.log('Prompt API failed, falling back to MediaPipe');
    }
  }
  
  // Fallback to MediaPipe if Prompt API is not available
  if (mediaPipeInitialized && llmInference) {
    return await useMediaPipe(question, faqResults, chatHistory);
  }
  
  return null;
};

// Chrome Prompt API integration
const usePromptAPI = async (question, faqResults, chatHistory) => {

    // Create session with chat history as initial prompts
    const initialPrompts = [
      {
        role: 'system',
        content: `You are a knowledgeable Thai food and cuisine specialist. Your role is to help customers learn about authentic Thai dishes, ingredients, cooking methods, and food culture using accurate information from the FAQ data. Be enthusiastic about Thai cuisine and highlight its unique flavors and traditions.
        
        Key guidelines:
        - Use the provided FAQ information to give accurate, helpful answers about Thai food
        - Emphasize the authentic flavors, spices, and cooking techniques of Thai cuisine
        - Mention popular dishes like Pad Thai, Tom Yum, Green Curry, and Som Tam
        - Highlight the balance of sweet, sour, spicy, and savory flavors in Thai cooking
        - Use markdown formatting to make responses visually appealing with **bold** for key dishes and ingredients, bullet points for features, and clear structure
        - Be encouraging about exploring Thai cuisine and trying new dishes
        - If asked about spice levels, explain the different heat options and how to adjust them
        - Always be helpful and supportive of the customer\'s interest in Thai food
        - **IMPORTANT: Keep all responses to 20 words or less**
        - Remember and reference previous conversation context when appropriate`
      }
    ];

    // Add chat history as conversation turns if available
    if (chatHistory && chatHistory.length > 0) {
      initialPrompts.push(...chatHistory);
    }


    const session = await LanguageModel.create({
      initialPrompts: initialPrompts
    });

  // Prepare FAQ context
  const faqContext = faqResults.map((result, index) => 
    `FAQ ${index + 1}:\nQuestion: ${result.metadata.question}\nAnswer: ${result.metadata.answer}`
  ).join('\n\n');

  // Create prompt with FAQ context and user question
  const prompt = `A customer is asking about Thai food and cuisine. Here's their question: "${question}"

Based on the following Thai food FAQ information, please provide a helpful, enthusiastic response:

FAQ Information:
${faqContext}

Please give a friendly, informative answer that helps them learn about Thai cuisine. Use markdown formatting to make your response visually appealing and highlight the authentic flavors and traditions of Thai food. **Keep your response to exactly 20 words or less.**`;

  // Get AI-generated answer
  const result = await session.prompt(prompt);
  
  // Clean up session
  session.destroy();
  
  return result;
};

// MediaPipe LLM Inference integration
const useMediaPipe = async (question, faqResults, chatHistory) => {
  if (!mediaPipeInitialized || !llmInference) {
    return null;
  }

  try {
    // Prepare FAQ context
    const faqContext = faqResults.map((result, index) => 
      `FAQ ${index + 1}:\nQuestion: ${result.metadata.question}\nAnswer: ${result.metadata.answer}`
    ).join('\n\n');

    // Create system prompt similar to Prompt API
    const systemPrompt = `You are a Thai food and cuisine specialist. You must answer ONLY using information from the FAQ that is related to the customer's question.

Instructions:
- Use only the FAQ entries that are relevant to the question to answer.
- Do NOT include any information or opinions not present in the relevant FAQ.
- If the answer is not in the relevant FAQ, say "Sorry, I don't have information about that."
- Use markdown formatting for clarity and highlight key points.
- **Keep your response to exactly 20 words or less.**
- Do not reference or mention the FAQ directly in your answer.`;

    // Create prompt with FAQ context and user question
    const prompt = `A customer is asking about Thai food and cuisine. Here is their question: "${question}"

Below are FAQ entries that are related to the question:

FAQ Information:
${faqContext}

Using only the information from the related FAQ above, give a friendly, informative answer. Do NOT answer outside the FAQ`;

    console.log(prompt);

    // Generate response using MediaPipe
    const response = await llmInference.generateResponse(prompt);
    
    return response;
  } catch (error) {
    console.error('MediaPipe inference failed:', error);
    return null;
  }
};

export const useVectorStore = () => {
  const STORAGE_KEY = 'vector_store_embeddings';

  const init = async () => {
    // Check Prompt API availability on initialization
    const promptAPIStatus = await checkPromptAPIAvailability();
    
    // Check if embeddings already exist in localStorage
    const existingEmbeddings = localStorage.getItem(STORAGE_KEY);
    if (existingEmbeddings) {
      return promptAPIStatus; // Return status even if already initialized
    }

    const extractor = await pipeline("feature-extraction", model);
    const embeddings = [];

    for (const faq of faqs) {
      const embedding = await extractor(faq.question + " " + faq.answer, {
        pooling: "mean",
        normalize: true,
      });
      
      const embeddingArray = embedding.tolist()[0];
      
      embeddings.push({
        embedding: embeddingArray,
        text: faq.question,
        metadata: { question: faq.question, answer: faq.answer },
      });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(embeddings));
  };

  const search = async (query, chatHistory = '') => {
    // Ensure embeddings are initialized
    await init();
    
    const extractor = await pipeline("feature-extraction", model);
    const queryEmbedding = await extractor(query, {
      pooling: "mean",
      normalize: true,
    });

    // Retrieve embeddings from localStorage
    const storedEmbeddings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    // Calculate similarity scores for all stored embeddings
    const resultsWithScores = storedEmbeddings.map((item, index) => {
      const similarity = cosineSimilarity(queryEmbedding.tolist()[0], item.embedding);
      return {
        ...item,
        similarity
      };
    });

    // Sort by similarity score (descending) and limit results
    const sortedResults = resultsWithScores
      .sort((a, b) => b.similarity - a.similarity)
    
    // Get the top FAQ results for context
    const topResults = sortedResults.slice(0, 5); // Use top 3 results for context
    
    // Try to use AI (Prompt API or MediaPipe) to generate enhanced answer
    let enhancedAnswer = await generateAIResponse(query, topResults, chatHistory);
    
    // Return enhanced answer if available, otherwise fall back to direct FAQ results
    if (enhancedAnswer) {
      return [enhancedAnswer];
    } else {
      return sortedResults.map((result) => result.metadata.answer);
    }
  };

  // Helper function to clear stored embeddings (useful for testing or resetting)
  const clearStorage = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    init,
    search,
    clearStorage,
    getPromptAPIStatus: checkPromptAPIAvailability,
    getMediaPipeStatus: () => ({ initialized: mediaPipeInitialized, instance: llmInference }),
  };
};
