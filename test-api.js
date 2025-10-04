const axios = require('axios');

async function testAPI() {
  console.log('Testing API...');

  try {
    // Test 1: Basic connectivity
    console.log('1. Testing basic connectivity...');
    const response = await axios.post('http://localhost:3000/api/chat', {
      query: 'test',
      model: 'command-r-plus'
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();