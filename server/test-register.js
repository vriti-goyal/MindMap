const axios = require('axios');

async function test() {
  try {
    console.log("Sending health check request...");
    const health = await axios.get('http://127.0.0.1:5000/health');
    console.log("Health Check Status:", health.status, health.data);

    console.log("Sending register request...");
    const res = await axios.post('http://127.0.0.1:5000/api/auth/register', {
      email: `test-${Date.now()}@example.com`,
      password: 'password123'
    });
    console.log("Register Status:", res.status);
    console.log("Register Response:", res.data);
  } catch (error) {
    console.error("Test failed:", error.response ? {
      status: error.response.status,
      data: error.response.data
    } : error.message);
  }
}

test();
