
import { pipeline, env } from '@huggingface/transformers';
import faqs from "@/faq.json";

const model = "Xenova/all-MiniLM-L6-v2";
env.allowLocalModels = false;

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

// Chrome Prompt API integration
const usePromptAPI = async (question, faqResults, chatHistory) => {
  // Check if Chrome Prompt API is available
  if (typeof LanguageModel === 'undefined') {
    return null;
  }

  // Check availability
  const available = await LanguageModel.availability();
  if (available === 'unavailable') {
    return null;
  }

    // Create session with chat history as initial prompts
    const initialPrompts = [
      {
        role: 'system',
        content: 'You are a knowledgeable Thai food and cuisine specialist. Your role is to help customers learn about authentic Thai dishes, ingredients, cooking methods, and food culture using accurate information from the FAQ data. Be enthusiastic about Thai cuisine and highlight its unique flavors and traditions.\n\nKey guidelines:\n- Use the provided FAQ information to give accurate, helpful answers about Thai food\n- Emphasize the authentic flavors, spices, and cooking techniques of Thai cuisine\n- Mention popular dishes like Pad Thai, Tom Yum, Green Curry, and Som Tam\n- Highlight the balance of sweet, sour, spicy, and savory flavors in Thai cooking\n- Use markdown formatting to make responses visually appealing with **bold** for key dishes and ingredients, bullet points for features, and clear structure\n- Be encouraging about exploring Thai cuisine and trying new dishes\n- If asked about spice levels, explain the different heat options and how to adjust them\n- Always be helpful and supportive of the customer\'s interest in Thai food\n- **IMPORTANT: Keep all responses to 20 words or less**\n- Remember and reference previous conversation context when appropriate'
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

export const useVectorStore = () => {
  const STORAGE_KEY = 'vector_store_embeddings';

  const init = async () => {
    // Check if embeddings already exist in localStorage
    const existingEmbeddings = localStorage.getItem(STORAGE_KEY);
    if (existingEmbeddings) {
      return; // Already initialized
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
      .slice(0, 10);
    console.log(sortedResults);
    // Get the top FAQ results for context
    const topResults = sortedResults.slice(0, 3); // Use top 3 results for context
    
    // Try to use Chrome Prompt API to generate enhanced answer
    let enhancedAnswer = await usePromptAPI(query, topResults, chatHistory);
    
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
  };
};
