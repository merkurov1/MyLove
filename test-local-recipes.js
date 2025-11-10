const axios = require('axios');

async function testLocalRecipes() {
  const baseUrl = 'http://localhost:3000';

  console.log('🏠 Testing local recipe search improvements...');
  console.log('');

  const queries = [
    { query: 'найди все рецепты еды', desc: 'Find all recipes' },
    { query: 'найди все рецепты еды', desc: 'Same query again (consistency test)' },
    { query: 'рецепт пасты с тунцом', desc: 'Specific recipe - pasta with tuna' },
    { query: 'еда', desc: 'Short query - food (optimized)' }
  ];

  for (const { query, desc } of queries) {
    try {
      console.log(`🧪 Testing: ${desc}`);
      console.log(`Query: "${query}"`);

      const startTime = Date.now();
      const response = await axios.post(`${baseUrl}/api/chat`, {
        query: query
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });

      const duration = Date.now() - startTime;

      console.log(`✅ Response in ${duration}ms`);
      console.log(`📝 Reply length: ${response.data.reply?.length || 0} chars`);
      console.log(`🔍 Sources: ${response.data.sources?.length || 0}`);

      // Check for recipe content
      const reply = response.data.reply || '';
      const hasRecipes = (reply.match(/рецепт|блюдо|ингредиент|готовить/gi) || []).length;
      console.log(`🍳 Recipe mentions: ${hasRecipes}`);

      // Check for consistency (multiple recipes)
      const recipeCount = (reply.match(/рецепт/gi) || []).length;
      console.log(`📚 Recipes found: ${recipeCount}`);

      // Show preview
      console.log('📄 Preview:');
      console.log(reply.substring(0, 300) + (reply.length > 300 ? '...' : ''));
      console.log('');

    } catch (error) {
      console.error('❌ Error:', error.response?.status, error.response?.statusText || error.message);
      console.log('');
    }
  }

  console.log('🎉 Local testing completed!');
  console.log('');
  console.log('🔍 Analysis:');
  console.log('- Multiple recipes should be found and listed');
  console.log('- Responses should be consistent for same queries');
  console.log('- Short queries should work without multi-query overhead');
  console.log('- Recipes should have proper formatting with ingredients');
}

testLocalRecipes().catch(console.error);