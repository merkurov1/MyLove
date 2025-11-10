// Тестовый скрипт для проверки YouTube транскрипции
import { YoutubeTranscript } from 'youtube-transcript'

async function getYouTubeTranscript(url) {
  try {
    // Попытка извлечь id видео
    const parseVideoId = (u) => {
      try {
        const parsed = new URL(u)
        // ?v= ID
        const v = parsed.searchParams.get('v')
        if (v && v.length === 11) return v
        // youtu.be short link -> pathname
        if (parsed.hostname.includes('youtu.be')) {
          const p = parsed.pathname.replace('/', '')
          if (p && p.length >= 11) return p.split('/')[0]
        }
        // watch path contains v in params; embed/shorts paths contain id in pathname
        const pathParts = parsed.pathname.split('/').filter(Boolean)
        // /embed/{id} or /shorts/{id}
        if (pathParts.length && (pathParts[0] === 'embed' || pathParts[0] === 'shorts')) {
          const candidate = pathParts[1]
          if (candidate && candidate.length >= 11) return candidate
        }
        // Fallback regex
        const idMatch = u.match(/([A-Za-z0-9_-]{11})/)
        return idMatch ? idMatch[1] : null
      } catch (e) {
        const idMatch = url.match(/([A-Za-z0-9_-]{11})/)
        return idMatch ? idMatch[1] : null
      }
    }

    const videoId = parseVideoId(url)
    console.log(`Parsed video ID: ${videoId}`)
    if (!videoId) {
      throw new Error('Не удалось распознать id видео в URL')
    }

    console.log('Calling YoutubeTranscript.fetchTranscript...')
    const transcriptResponse = await YoutubeTranscript.fetchTranscript(videoId)
    console.log('Transcript response type:', typeof transcriptResponse)
    console.log('Transcript response length:', transcriptResponse.length)

    if (!transcriptResponse) throw new Error('youtube-transcript вернул пустой ответ')
    if (Array.isArray(transcriptResponse)) {
      const text = transcriptResponse.map((seg) => seg.text).join(' ')
      console.log('Joined transcript from array, length:', text.length)
      return text
    }
    if (typeof transcriptResponse === 'string') {
      console.log('Got transcript as string, length:', transcriptResponse.length)
      return transcriptResponse
    }
    throw new Error('Не удалось получить транскрипцию из youtube-transcript')
  } catch (error) {
    console.error('YouTube transcript error:', error)
    throw new Error(error?.message || 'Не удалось получить транскрипцию YouTube видео')
  }
}

async function testYouTubeTranscript() {
  const testUrls = [
    // Видео без субтитров (Rick Astley)
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    // Попробуем видео с субтитрами - TED talk
    'https://www.youtube.com/watch?v=6Af6b_wyiwI',
    // Ещё одно видео с субтитрами
    'https://www.youtube.com/watch?v=jNQXAC9IVRw'
  ]

  for (const url of testUrls) {
    try {
      console.log(`\n=== Testing URL: ${url} ===`)
      const transcript = await getYouTubeTranscript(url)
      console.log(`✓ Success! Transcript length: ${transcript.length}`)
      if (transcript.length > 0) {
        console.log(`First 200 chars: ${transcript.substring(0, 200)}...`)
      } else {
        console.log('No transcript available for this video')
      }
    } catch (error) {
      console.error(`✗ Failed for ${url}:`, error.message)
    }
  }
}

testYouTubeTranscript().catch(console.error)