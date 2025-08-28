<template>
  <UContainer class="py-8">
    <UCard class="max-w-3xl mx-auto shadow-lg">
      <template #header>
        <div class="text-center">
          <div class="flex items-center justify-center gap-3 mb-3">
            <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
              <UIcon name="i-heroicons-fire" class="text-white text-2xl" />
            </div>
            <h1 class="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              ThaiFood Assistant
            </h1>
          </div>
        </div>
      </template>

      <div ref="chatContainer" class="space-y-4 h-96 overflow-y-auto px-2">
        <div v-if="isInitializing" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-orange-500 mx-auto mb-4" />
            <p class="text-lg text-gray-600">Initializing ThaiFood Assistant...</p>
            <p class="text-sm text-gray-500">Loading knowledge base and AI models</p>
          </div>
        </div>
        
        <div v-else v-for="(message, index) in messages" :key="index" class="flex items-start gap-4">
          <UAvatar 
            :src="undefined" 
            :alt="message.from"
            :class="message.from === 'bot' ? 'ring-2 ring-orange-100' : ''"
          >
            <span v-if="message.from === 'user'" class="text-2xl">😀</span>
            <span v-else-if="message.from === 'bot'" class="text-2xl">🇹🇭</span>
          </UAvatar>
          <div class="grid gap-1 flex-1">
            <div class="font-semibold text-sm">
              {{ message.from === 'user' ? 'You' : 'ThaiFood Assistant' }}
            </div>
            <div class="prose text-sm">
              <div v-if="message.isLoading" class="flex items-center gap-2 text-orange-600">
                <span class="dot dot1">.</span>
                <span class="dot dot2">.</span>
                <span class="dot dot3">.</span>
              </div>
              <div v-else class="markdown-content" v-html="renderMarkdown(message.text)"></div>
            </div>
            <div v-if="message.faqSources && message.faqSources.length > 0" class="mt-2 text-xs text-gray-500">
              <div class="font-medium text-orange-600">Related Thai Food Info:</div>
              <div v-for="(source, idx) in message.faqSources" :key="idx" class="ml-2 text-gray-600">
                • {{ source.question.substring(0, 60) }}...
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center gap-2">
          <UInput 
            v-model="input" 
            placeholder="Ask about Thai food..." 
            class="flex-1" 
            @keyup.enter="sendMessage"
            :disabled="isProcessing || isInitializing"
            size="lg"
          />
          <UButton 
            @click="sendMessage" 
            :disabled="isProcessing || !input.trim() || isInitializing"
            :loading="isProcessing"
            size="lg"
            class="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
          >
            {{ isProcessing ? 'Exploring...' : 'Ask' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UContainer>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import { marked } from 'marked';
import { useVectorStore } from '@/composables/useVectorStore';

const { init, search } = useVectorStore();

const messages = ref([]);
const input = ref('');
const isProcessing = ref(false);
const isInitializing = ref(true);
const chatContainer = ref(null);

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true
});

// Render markdown function
const renderMarkdown = (text) => {
  if (!text) return '';
  return marked(text);
};

// Auto-scroll to bottom function
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
};

// Watch for new messages and scroll to bottom
watch(messages, () => {
  scrollToBottom();
}, { deep: true });

const sendMessage = async () => {
  if (!input.value.trim() || isProcessing.value) return;

  const userMessage = input.value;
  input.value = '';
  isProcessing.value = true;

  // Add user message
  messages.value.push({ from: 'user', text: userMessage });

  // Add loading bot message
  const botMessageIndex = messages.value.length;
  messages.value.push({ 
    from: 'bot', 
    text: '', 
    isLoading: true,
    faqSources: []
  });

  // Get chat history for context (last 10 exchanges)
  const chatHistory = messages.value
    .slice(-10) // Get last 10 messages
    .map(msg => ({
      role: msg.from === 'user' ? 'user' : 'assistant',
      content: msg.text
    }))
    .filter(msg => msg.content && msg.content.trim()); // Filter out empty messages

  // Search for FAQ results with chat history context
  const results = await search(userMessage, chatHistory);
  
  if (results && results.length > 0) {
    // Update bot message with result
    messages.value[botMessageIndex] = {
      from: 'bot',
      text: results[0], // First result is the enhanced answer
      isLoading: false,
      faqSources: results.length > 1 ? results.slice(1).map(result => ({ 
        question: result.question || result,
        answer: result.answer || result 
      })) : []
    };
  } else {
    messages.value[botMessageIndex] = {
      from: 'bot',
      text: "I don't have specific information about that aspect of Thai food, but I can help you with recipes, ingredients, cooking methods, regional cuisines, and more! What would you like to know about Thai cuisine?",
      isLoading: false,
      faqSources: []
    };
  }
  
  isProcessing.value = false;
};

onMounted(async () => {
  await init();
  messages.value.push({ 
    from: 'bot', 
    text: 'สวัสดี! 👋 **Welcome to the ThaiFood Assistant!**\n\nAsk me anything about Thai food, dishes, or cooking. 🇹🇭',
    isLoading: false,
    faqSources: []
  });
  isInitializing.value = false; // Set initializing to false after initialization
});
</script>

<style scoped>
@reference "tailwindcss";

.markdown-content :deep(h1) {
  @apply text-2xl font-bold mt-6 mb-4 text-gray-900 border-b-2 border-orange-200 pb-2;
}

.markdown-content :deep(h2) {
  @apply text-xl font-semibold mt-5 mb-3 text-gray-800;
}

.markdown-content :deep(h3) {
  @apply text-lg font-semibold mt-4 mb-2 text-gray-800;
}

.markdown-content :deep(strong) {
  @apply font-bold text-orange-700;
}

.markdown-content :deep(em) {
  @apply italic text-gray-700;
}

.markdown-content :deep(code) {
  @apply bg-orange-50 px-2 py-1 rounded-md text-sm font-mono text-orange-800 border border-orange-200;
}

.markdown-content :deep(pre) {
  @apply bg-gray-50 p-4 rounded-lg text-sm font-mono overflow-x-auto my-3 border border-gray-200 shadow-sm;
}

.markdown-content :deep(ul) {
  @apply list-disc list-inside space-y-2 my-3 ml-4;
}

.markdown-content :deep(ol) {
  @apply list-decimal list-inside space-y-2 my-3 ml-4;
}

.markdown-content :deep(li) {
  @apply text-gray-700 leading-relaxed;
}

.markdown-content :deep(a) {
  @apply text-orange-600 hover:text-orange-800 underline decoration-orange-300 hover:decoration-orange-500 transition-colors;
}

.markdown-content :deep(blockquote) {
  @apply border-l-4 border-orange-400 pl-4 italic text-gray-700 my-4 bg-orange-50 py-3 rounded-r-lg;
}

.markdown-content :deep(p) {
  @apply mb-3 text-gray-700 leading-relaxed;
}

.markdown-content :deep(table) {
  @apply w-full border-collapse border border-gray-300 my-4 rounded-lg overflow-hidden shadow-sm;
}

.markdown-content :deep(th) {
  @apply border border-gray-300 px-3 py-2 bg-orange-50 font-semibold text-left text-gray-800;
}

.markdown-content :deep(td) {
  @apply border border-gray-300 px-3 py-2 text-gray-700;
}

.markdown-content :deep(hr) {
  @apply border-t-2 border-orange-200 my-6;
}

.markdown-content :deep(img) {
  @apply rounded-lg shadow-md max-w-full h-auto;
}

.markdown-content :deep(::marker) {
  @apply text-orange-500;
}

.typing-animation {
  font-weight: 500;
  letter-spacing: 0.5px;
}
.dot {
  animation: blink 1.4s infinite both;
  font-size: 1.5em;
  line-height: 1;
  display: inline-block;
}
.dot1 { animation-delay: 0s; }
.dot2 { animation-delay: 0.2s; }
.dot3 { animation-delay: 0.4s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}
</style>
