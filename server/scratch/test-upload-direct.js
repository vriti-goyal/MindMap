require('dotenv').config();
const prisma = require('../src/config/prisma');
const { uploadDocument } = require('../src/controllers/documentController');

// Create mock Express request and response
const req = {
  user: { userId: 'aba5061a-48bc-49e0-bd26-c6cda413539c' }, // test user from db
  body: {
    title: 'Mock URL Source',
    sourceType: 'URL',
    url: 'https://example.com'
  },
  file: null
};

const res = {
  status(code) {
    console.log("Status set to:", code);
    return this;
  },
  json(data) {
    console.log("JSON response sent:", data);
  }
};

async function main() {
  console.log("Invoking uploadDocument directly to inspect full stack trace...");
  try {
    await uploadDocument(req, res);
  } catch (error) {
    console.error("CRITICAL EXCEPTION IN CONTROLLER:", error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
