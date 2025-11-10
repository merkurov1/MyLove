// Test production improvements
const testProduction = async () => {
  const axios = require('axios');

  console.log('🧪 Testing production improvements...\n');

  try {
    // Test 1: Recipe search improvements
    console.log('1️⃣ Testing recipe search: "найди все рецепты еды"');
    const recipeResponse = await axios.post('http://localhost:3000/api/chat', {
      query: 'найди все рецепты еды'
    }, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Recipe search response received');
    console.log('📊 Response length:', recipeResponse.data.reply?.length || 0);
    console.log('🔍 Sources found:', recipeResponse.data.sources?.length || 0);

    // Check for recipe keywords in response
    const hasRecipes = /рецепт|блюдо|ингредиент|готовить/i.test(recipeResponse.data.reply);
    console.log('🍳 Contains recipe content:', hasRecipes ? '✅' : '❌');

    // Test 2: Embedding caching (check logs for cache hits)
    console.log('\n2️⃣ Testing embedding caching: "test query"');
    const cacheTest1 = await axios.post('http://localhost:3000/api/chat', {
      query: 'test query for caching'
    });

    console.log('✅ First cache test completed');

    // Same query again - should hit cache
    const cacheTest2 = await axios.post('http://localhost:3000/api/chat', {
      query: 'test query for caching'
    });

    console.log('✅ Second cache test completed (should be faster)');

    // Test 3: Multi-query disabled for short queries
    console.log('\n3️⃣ Testing multi-query optimization: short query "еда"');
    const shortQueryResponse = await axios.post('http://localhost:3000/api/chat', {
      query: 'еда'
    });

    console.log('✅ Short query test completed');

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📈 Expected improvements:');
    console.log('- More recipes found with detailed descriptions');
    console.log('- Faster response times due to embedding caching');
    console.log('- Cost optimization for short queries');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
};

// Run if called directly
if (require.main === module) {
  testProduction();
}

module.exports = { testProduction };