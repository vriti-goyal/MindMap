const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); // Defaults to GEMINI_API_KEY from process.env

const generateEmbedding = async (text) => {
  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
      config: { outputDimensionality: 768 }
    });
    return response.embeddings[0].values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding: ' + error.message);
  }
};

const generateMapData = async (text, mode) => {
  try {
    const systemInstruction = `You are a mind map generator. Based on the user input, extract key concepts as nodes and their relationships as edges.
    Nodes should have:
    - id (unique string)
    - type (e.g., "concept", "subconcept", "detail")
    - label (short text label)
    - xPos, yPos (relative floats starting around 0,0 spread out visually)
    - content (optional longer description)
    Edges should have:
    - id (unique string)
    - sourceNodeId
    - targetNodeId
    
    Mode is: ${mode} (if prompt-only, rely on general knowledge + prompt; if upload-only, rely STRICTLY on the document text; if hybrid, use both).
    Return ONLY a valid JSON object matching this schema:
    { "nodes": [ ... ], "edges": [ ... ] }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `Input text:\n\n${text}` }]
        }
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    const data = JSON.parse(response.text);
    return data;
  } catch (error) {
    console.error('Error generating map data via Gemini:', error);
    throw new Error('Failed to generate map structure.');
  }
};

const generateTitleFromNodes = async (nodeLabels) => {
  try {
    const systemInstruction = `You are a professional mind map categorizer. Based on a list of concept labels in a mind map, generate a highly descriptive, concise, and clean title for the map. 
    The title must be between 3 to 6 words. Avoid quotation marks, markdown formatting, or prefix/suffix. Just return the raw text title.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `Concept labels:\n${nodeLabels.join('\n')}` }]
        }
      ],
      config: {
        systemInstruction,
      }
    });

    return response.text.trim();
  } catch (error) {
    console.error('Error generating AI title:', error);
    throw new Error('Failed to generate title.');
  }
};

module.exports = {
  generateEmbedding,
  generateMapData,
  generateTitleFromNodes
};
