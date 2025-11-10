const axios = require('axios');

async function testChatAPI() {
  try {
    const response = await axios.post('http://localhost:3000/api/chat', {
      query: 'test query'
    });
    console.log('API response:', response.data);
  } catch (error) {
    console.error('API error:', error.response?.data || error.message);
  }
}

testChatAPI();