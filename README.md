# 🚀 On-Device AI Chatbot

A demo chatbot that uses **On-device AI** to convert text to vectors and Chrome's built-in Prompt API for intelligent responses.

## ✨ What it does

- **Local AI**: Uses `all-MiniLM-L6-v2` model to convert text to vectors on your device
- **Smart Search**: Finds relevant answers using semantic similarity
- **Built-in AI**: Leverages built-in Prompt API for enhanced responses
- **Thai Food Expert**: Specialized knowledge about authentic Thai cuisine

## Befor start
Download gemma3-1B-it-int4.task from https://www.kaggle.com/models/google/gemma-3/tfLite/gemma3-1b-it-int4 and put in to public directory 

## 🚀 Quick Start

```bash
npm install
npm run dev 
```

Open `http://localhost:3000` in Chrome 126+

## 🛠️ Tech Stack

- **Frontend**: Nuxt.js + Vue 3
- **AI**: Hugging Face Transformers.js
- **Vector Model**: Xenova/all-MiniLM-L6-v2
- **AI Chat**: Prompt API

## 💡 How it works

1. **Text → Vector**: Your question gets converted to a vector locally
2. **Search**: Finds similar FAQ entries using cosine similarity
3. **AI Response**: Chrome's Prompt API generates intelligent answers
4. **Display**: Shows response with markdown formatting

---

**Experience on-device AI today! 🧠✨**
