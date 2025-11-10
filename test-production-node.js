const axios = require('axios');

// Production testing for recipe search
async function testProductionRecipes() {
  const prodUrl = 'https://mylove-dashboard.vercel.app';

  console.log('🚀 Testing production recipe search...');
  console.log('URL:', prodUrl);
  console.log('');

  const queries = [
    { query: 'найди все рецепты еды', desc: 'Find all recipes' },
    { query: 'найди все рецепты еды', desc: 'Same query again (consistency test)' },
    { query: 'рецепт пасты с тунцом', desc: 'Specific recipe - pasta with tuna' },
    { query: 'как приготовить чахохбили', desc: 'Specific dish - chakhokhbili' },
    { query: 'еда', desc: 'Short query - food' }
  ];

  for (const { query, desc } of queries) {
    try {
      console.log(`🧪 Testing: ${desc}`);
      console.log(`Query: "${query}"`);

      const startTime = Date.now();
      const response = await axios.post(`${prodUrl}/api/chat`, {
        query: query
      }, {
        timeout: 60000,
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

      // Show preview
      console.log('📄 Preview:', reply.substring(0, 150) + '...');
      console.log('');

    } catch (error) {
      console.error('❌ Error:', error.response?.status, error.response?.statusText || error.message);
      if (error.response?.data) {
        console.error('Response:', error.response.data);
      }
      console.log('');
    }
  }

  console.log('🎉 Testing completed!');
}

// Run if called directly
if (require.main === module) {
  testProductionRecipes().catch(console.error);
}

module.exports = { testProductionRecipes };