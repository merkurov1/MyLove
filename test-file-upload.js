const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')

async function testFileUpload() {
  console.log('🧪 Тестируем загрузку файла...')
  
  const baseUrl = 'https://newlove-viom.vercel.app'
  
  try {
    // Создаем тестовый файл
    const testContent = 'Это тестовый файл для проверки системы. Он содержит несколько предложений. Каждое предложение должно быть обработано правильно.'
    fs.writeFileSync('/tmp/test-upload.txt', testContent)
    
    // Создаем FormData
    const form = new FormData()
    form.append('file', fs.createReadStream('/tmp/test-upload.txt'))
    form.append('type', 'file')
    
    console.log('📄 Отправляем тестовый файл...')
    
    const response = await axios.post(`${baseUrl}/api/process`, form, {
      headers: {
        ...form.getHeaders()
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

testFileUpload()