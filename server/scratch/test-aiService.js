require('dotenv').config();
const aiService = require('../src/services/aiService');

async function run() {
  try {
    console.log('Testing generateEmbedding with key length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
    const embedding = await aiService.generateEmbedding('Hello world');
    console.log('Embedding dimension:', embedding.length);
    
    console.log('Testing generateMapData...');
    const mapData = await aiService.generateMapData('Hello world', 'prompt');
    console.log('Map nodes:', mapData.nodes.length);
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

run();
