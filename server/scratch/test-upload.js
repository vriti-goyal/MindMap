const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function run() {
  try {
    console.log("1. Registering user for testing...");
    const regRes = await axios.post('http://localhost:5000/api/auth/register', {
      email: `test-${Date.now()}@example.com`,
      password: 'password123'
    });
    const token = regRes.data.token;
    console.log("Token acquired:", token.substring(0, 15) + "...");

    // Configure axios with token
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    console.log("\n2. Creating a mock text file for upload...");
    const dummyPath = path.join(__dirname, 'dummy-document.pdf');
    await fs.writeFile(dummyPath, 'Dummy PDF content for testing');

    console.log("\n3. Constructing FormData and sending upload request...");
    // Since we're in Node, we use standard FormData or simulated request.
    // To make it easy without installing form-data package in scratch,
    // let's try to upload a link first which doesn't require multipart boundary complexity,
    // and then let's test file upload.
    
    // Test link upload (URL)
    console.log("Sending URL upload request...");
    const urlRes = await axios.post('http://localhost:5000/api/documents/upload', {
      title: 'Mock URL Source',
      sourceType: 'URL',
      url: 'https://example.com'
    });
    console.log("URL Upload Success:", urlRes.status, urlRes.data);

    // Clean up
    await fs.unlink(dummyPath).catch(() => {});
  } catch (err) {
    console.error("Upload test failed:", err.response ? {
      status: err.response.status,
      data: err.response.data
    } : err.message);
  }
}

run();
