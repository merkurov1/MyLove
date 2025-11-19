#!/usr/bin/env node
/**
 * Test script to verify chat fixes
 * Tests both Russian and English queries to ensure proper encoding and response
 */

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

const testQueries = [
  {
    name: 'English query about Anton',
    query: 'Who is Anton Merkurov?',
    expectedLanguage: 'en',
    shouldContain: ['Anton', 'Merkurov']
  },
  {
    name: 'Russian query about Anton',
    query: 'Кто такой Антон Меркуров?',
    expectedLanguage: 'ru',
    shouldContain: ['Антон', 'Меркуров']
  },
  {
    name: 'Russian simple question',
    query: 'Привет, как дела?',
    expectedLanguage: 'ru',
    shouldContain: []
  },
  {
    name: 'English art query',
    query: 'Tell me about Basquiat',
    expectedLanguage: 'en',
    shouldContain: ['Basquiat']
  }
];

async function testChat(query, testName) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`📝 Query: "${query}"`);
  
  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ HTTP Error ${response.status}:`, errorData);
      return { success: false, error: errorData };
    }

    const data = await response.json();
    
    if (!data.reply) {
      console.error('❌ No reply in response:', data);
      return { success: false, error: 'No reply field' };
    }

    console.log(`✅ Response received (${data.reply.length} chars)`);
    console.log(`📄 Preview: "${data.reply.substring(0, 150)}..."`);
    
    // Check for encoding issues (gibberish patterns)
    const hasGibberish = /[^\x00-\x7F\u0400-\u04FF\s.,!?;:()"'«»—\-]/g.test(data.reply);
    if (hasGibberish) {
      console.warn('⚠️  Warning: Detected non-standard characters (possible encoding issue)');
    }
    
    // Check if response is too short or suspiciously malformed
    if (data.reply.length < 10) {
      console.warn('⚠️  Warning: Response is very short');
    }
    
    // Check for control characters
    const hasControlChars = /[\u0000-\u001F\u007F-\u009F]/.test(data.reply);
    if (hasControlChars) {
      console.error('❌ Found control characters in response!');
      return { success: false, error: 'Control characters detected' };
    }
    
    return { success: true, data };
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting chat API tests...');
  console.log(`🔗 API URL: ${API_URL}`);
  
  const results = {
    passed: 0,
    failed: 0,
    total: testQueries.length
  };
  
  for (const test of testQueries) {
    const result = await testChat(test.query, test.name);
    
    if (result.success) {
      // Check expected content
      let contentCheck = true;
      for (const word of test.shouldContain) {
        if (!result.data.reply.includes(word)) {
          console.warn(`⚠️  Expected word "${word}" not found in response`);
          contentCheck = false;
        }
      }
      
      if (contentCheck) {
        results.passed++;
        console.log('✅ Test PASSED');
      } else {
        results.failed++;
        console.log('⚠️  Test PASSED with warnings');
      }
    } else {
      results.failed++;
      console.log('❌ Test FAILED');
    }
    
    // Wait a bit between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results:');
  console.log(`   Total: ${results.total}`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log('='.repeat(60));
  
  if (results.failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('💔 Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
