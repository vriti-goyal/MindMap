require('dotenv').config();
const prisma = require('../src/config/prisma');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function runTest() {
  try {
    // 1. Get or Create User
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { email: 'test@example.com', passwordHash: 'hash' }
      });
      console.log('Created test user:', user.id);
    } else {
      console.log('Using existing user:', user.id);
    }

    // 2. Generate Token
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'secret');

    // 3. Prepare FormData
    const formData = new FormData();
    formData.append('prompt', 'I want a mind map about artificial intelligence');

    // 4. Send Request
    console.log('Sending request to /api/generate...');
    const response = await axios.post('http://localhost:5000/api/generate', formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    console.log('\n--- SUCCESS ---');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n--- ERROR ---');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
