require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('Testing with key:', process.env.GEMINI_API_KEY);
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: 'Hello world',
      config: { outputDimensionality: 768 }
    });
    console.log('Success! Dimensions:', response.embeddings[0].values.length);
  } catch (error) {
    console.error('Gemini API Error:', error);
  }
}

test();
