// Тестовый скрипт для проверки API process
async function testProcessAPI() {
  const testUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Без субтитров
    'https://httpbin.org/html' // Веб-страница для теста
  ]

  try {
    const response = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'links',
        links: testUrls,
        sourceId: 'c5aab739-7112-4360-be9e-45edf4287c42'
      })
    })

    const result = await response.json()
    console.log('API Response:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Test error:', error)
  }
}

testProcessAPI()