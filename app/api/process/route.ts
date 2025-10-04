import { NextRequest, NextResponse } from 'next/server'
import { createEmbeddingProvider } from '@/lib/embeddingProviders'
import { supabase } from '@/utils/supabase/server'
import crypto from 'crypto'
import axios from 'axios'
import * as cheerio from 'cheerio'

// Функция для разбиения текста на чанки
function splitIntoChunks(text: string, maxChunkSize: number = 1000): string[] {
  console.log('splitIntoChunks called with text length:', text.length)
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  console.log('Sentences found:', sentences.length)
  
  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (currentChunk.length + trimmedSentence.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = trimmedSentence
      } else {
        // Если одно предложение больше maxChunkSize, добавляем его как есть
        chunks.push(trimmedSentence)
      }
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  const finalChunks = chunks.filter(chunk => chunk.length > 10) // Исключаем очень короткие чанки
  console.log('Final chunks count:', finalChunks.length)
  console.log('Final chunks lengths:', finalChunks.map(c => c.length))
  
  return finalChunks
}

// Функция для вычисления checksum
function calculateChecksum(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

// Функция для получения транскрипции YouTube
async function getYouTubeTranscript(url: string): Promise<string> {
  try {
    // Для простоты пока возвращаем заглушку
    // В реальном проекте здесь будет youtube-transcript
    return `Транскрипция YouTube видео: ${url}. Это тестовая транскрипция для демонстрации работы системы. В реальном проекте здесь будет использоваться библиотека youtube-transcript для получения реальных субтитров видео.`
  } catch (error) {
    console.error('YouTube transcript error:', error)
    throw new Error('Не удалось получить транскрипцию YouTube видео')
  }
}

// Функция для скрейпинга веб-страницы
async function scrapeWebPage(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    })

    const $ = cheerio.load(response.data)
    
    // Удаляем ненужные элементы
    $('script, style, nav, header, footer, aside, .advertisement').remove()
    
    // Извлекаем основной текст
    let content = ''
    $('h1, h2, h3, h4, h5, h6, p, article, main, .content, .post-content').each((_: any, element: any) => {
      const text = $(element).text().trim()
      if (text.length > 20) {
        content += text + '\n\n'
      }
    })

    if (!content.trim()) {
      // Fallback: берем весь текст из body
      content = $('body').text()
    }

    return content.trim()
  } catch (error) {
    console.error('Web scraping error:', error)
    throw new Error(`Не удалось получить содержимое страницы: ${url}`)
  }
}

// Функция для обработки и сохранения чанков
async function processAndSaveChunks(
  content: string, 
  sourceId: string, 
  metadata: Record<string, any> = {}
) {
  console.log('processAndSaveChunks called with:', { 
    contentLength: content.length, 
    sourceId, 
    metadata 
  })
  
  console.log('Environment check:', {
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? 'SET' : 'NOT_SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET'
  })
  
  const embeddingProvider = createEmbeddingProvider()
  console.log('Embedding provider created:', embeddingProvider.name)
  
  const chunks = splitIntoChunks(content)
  console.log('Chunks created:', chunks.length)
  
  let savedChunks = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      console.log(`Processing chunk ${i + 1}/${chunks.length}, length: ${chunk.length}`)
      const checksum = calculateChecksum(chunk)
      
      // Проверяем, существует ли уже такой чанк
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('checksum', checksum)
        .single()

      if (existingDoc) {
        console.log(`Chunk ${i + 1}: already exists, skipping`)
        continue
      }

      // Генерируем эмбеддинг
      console.log(`Chunk ${i + 1}: generating embedding...`)
      const embedding = await embeddingProvider.generateEmbedding(chunk)
      console.log(`Chunk ${i + 1}: embedding generated, length: ${embedding.length}`)

      // Сохраняем в базу данных
      console.log(`Chunk ${i + 1}: saving to database...`)
      const { error } = await supabase
        .from('documents')
        .insert({
          content: chunk,
          embedding,
          checksum,
          source_id: sourceId,
          metadata: {
            ...metadata,
            chunk_length: chunk.length,
            embedding_provider: embeddingProvider.name.toLowerCase()
          },
          embedding_provider: embeddingProvider.name.toLowerCase()
        })

      if (error) {
        console.error(`Chunk ${i + 1}: save error:`, error)
      } else {
        console.log(`Chunk ${i + 1}: saved successfully`)
        savedChunks++
      }
    } catch (error) {
      console.error(`Chunk ${i + 1}: processing error:`, error)
    }
  }

  return { totalChunks: chunks.length, savedChunks }
}

export async function POST(request: NextRequest) {
  try {
    console.log('API POST request received')
    const contentType = request.headers.get('content-type') || ''
    console.log('Content type:', contentType)

    if (contentType.includes('multipart/form-data')) {
      // Обработка файлов
      const formData = await request.formData()
      const file = formData.get('file') as File
      const type = formData.get('type') as string
      const sourceId = formData.get('sourceId') as string || process.env.DEFAULT_SOURCE_ID || 'c5aab739-7112-4360-be9e-45edf4287c42'

      if (!file || type !== 'file') {
        console.log('File validation failed:', { file: !!file, type })
        return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
      }

      console.log('Processing file:', file.name, 'Size:', file.size)
      
      // Читаем содержимое файла
      const content = await file.text()
      console.log('File content length:', content.length)
      
      const metadata = {
        filename: file.name,
        file_size: file.size,
        file_type: file.type,
        source_type: 'file'
      }

      console.log('Starting chunk processing...')
      const result = await processAndSaveChunks(content, sourceId, metadata)
      console.log('Chunk processing result:', result)
      
      return NextResponse.json({
        success: true,
        message: 'Файл успешно обработан',
        chunksCount: result.savedChunks,
        totalChunks: result.totalChunks
      })

    } else if (contentType.includes('application/json')) {
      // Обработка ссылок
      const body = await request.json()
      const { type, links, sourceId } = body
      const finalSourceId = sourceId || process.env.DEFAULT_SOURCE_ID || 'c5aab739-7112-4360-be9e-45edf4287c42'

      if (type !== 'links' || !Array.isArray(links)) {
        return NextResponse.json({ error: 'Неверный формат данных' }, { status: 400 })
      }

      let processedCount = 0
      const results = []

      for (const link of links) {
        try {
          let content = ''
          let metadata: Record<string, any> = {
            url: link,
            source_type: 'link'
          }

          if (link.includes('youtube.com') || link.includes('youtu.be')) {
            // YouTube видео
            content = await getYouTubeTranscript(link)
            metadata.content_type = 'youtube_video'
          } else {
            // Веб-страница
            content = await scrapeWebPage(link)
            metadata.content_type = 'web_article'
          }

          const result = await processAndSaveChunks(content, finalSourceId, metadata)
          processedCount++
          results.push({
            url: link,
            success: true,
            chunksCount: result.savedChunks
          })

        } catch (error) {
          console.error(`Ошибка обработки ссылки ${link}:`, error)
          results.push({
            url: link,
            success: false,
            error: error instanceof Error ? error.message : 'Неизвестная ошибка'
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Обработано ссылок: ${processedCount} из ${links.length}`,
        processedCount,
        totalLinks: links.length,
        results
      })

    } else {
      return NextResponse.json({ error: 'Неподдерживаемый тип контента' }, { status: 400 })
    }

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}