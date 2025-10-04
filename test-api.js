const axios = require('axios')

async function testAPI() {
  console.log('🧪 Тестируем API напрямую...')
  
  // Используем правильный URL из списка проектов
  const baseUrl = 'https://newlove-viom.vercel.app'
  
  try {
    // Тест обработки ссылки
    console.log('📝 Отправляем тестовую ссылку...')
    
    const response = await axios.post(`${baseUrl}/api/process`, {
      type: 'links',
      links: ['https://example.com']
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })
    
    console.log('✅ Ответ API:', response.status)
    console.log('📊 Данные ответа:', response.data)
    
  } catch (error) {
    console.error('❌ Ошибка API:', error.message)
    if (error.response) {
      console.error('📋 Status:', error.response.status)
      console.error('📋 Data:', error.response.data)
    }
  }
}

testAPI()