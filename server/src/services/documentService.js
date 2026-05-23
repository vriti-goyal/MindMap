const pdfParse = require('pdf-parse');
const cheerio = require('cheerio');
const axios = require('axios');
const { YoutubeTranscript } = require('youtube-transcript');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); // Defaults to GEMINI_API_KEY from process.env

const processPDF = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF document.');
  }
};

const processURL = async (url) => {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Remove scripts and styles
    $('script, style').remove();
    
    // Extract text from body
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return text;
  } catch (error) {
    console.error('Error fetching URL:', error);
    throw new Error('Failed to fetch or parse URL.');
  }
};

const processYouTube = async (url) => {
  try {
    const transcripts = await YoutubeTranscript.fetchTranscript(url);
    const text = transcripts.map(t => t.text).join(' ');
    return text;
  } catch (error) {
    console.error('Error fetching YouTube transcript:', error);
    throw new Error('Failed to fetch YouTube transcript. Ensure the video has closed captions.');
  }
};

const processImage = async (buffer, mimeType) => {
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    { text: 'Extract all the text and meaningful content from this image.' },
                    {
                        inlineData: {
                            data: buffer.toString('base64'),
                            mimeType: mimeType || 'image/jpeg'
                        }
                    }
                ]
            }
        ]
    });
    return response.text;
  } catch (error) {
    console.error('Error processing Image via Gemini Vision:', error);
    throw new Error('Failed to process image content.');
  }
};

module.exports = {
  processPDF,
  processURL,
  processYouTube,
  processImage
};
