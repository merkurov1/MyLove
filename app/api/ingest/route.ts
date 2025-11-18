import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase/server'
import { adaptiveChunkText } from '@/lib/chunking-v2'
import { getEmbedding } from '@/lib/embedding-ai'
import crypto from 'crypto'

// core Node modules (require at runtime)
const fs = require('fs')
const os = require('os')
const path = require('path')
const child_process = require('child_process')

export const runtime = 'nodejs'

function tryRequire(name: string) {
  try {
    // prevent bundlers from statically resolving optional deps
    // eslint-disable-next-line no-eval
    return eval('require')(name)
  } catch (e) {
    return null
  }
}

function isCmdAvailable(cmd: string) {
  try {
    const r = child_process.spawnSync('which', [cmd], { encoding: 'utf-8' })
    return r.status === 0 && !!r.stdout
  } catch (e) {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const sourceId = (form.get('sourceId') as string) || process.env.DEFAULT_SOURCE_ID || null

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

    // Проверяем размер файла
    const maxSize = 4.5 * 1024 * 1024; // 4.5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: `file_too_large`, 
        details: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds limit of 4.5MB` 
      }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const name = (file.name || 'upload').toLowerCase()
    let text = ''

    if (name.endsWith('.pdf')) {
      // 1) pdf-parse (if installed)
      try {
        const pdfParse = tryRequire('pdf-parse')
        if (pdfParse) {
          const pd = await pdfParse(buf)
          text = String(pd?.text || '')
        }
      } catch (e) {
        console.warn('[ingest] pdf-parse error', String(e))
      }

      // 2) pdfjs-dist fallback
      if (!text) {
        try {
          const pdfjs = tryRequire('pdfjs-dist/legacy/build/pdf.js') || tryRequire('pdfjs-dist')
          if (pdfjs) {
            const loading = pdfjs.getDocument({ data: buf })
            const pdf = await loading.promise
            let acc = ''
            for (let i = 1; i <= pdf.numPages; i++) {
              const p = await pdf.getPage(i)
              const c = await p.getTextContent()
              acc += c.items.map((it: any) => it.str || '').join(' ') + '\n\n'
            }
            text = acc.trim()
          }
        } catch (e) {
          console.warn('[ingest] pdfjs fallback error', String(e))
        }
      }

      // 3) OCR.space (cloud) fallback
      if (!text && process.env.OCR_SPACE_API_KEY) {
        try {
          const FormData = tryRequire('form-data')
          const axios = tryRequire('axios') || require('axios')
          if (FormData && axios) {
            const fd = new FormData()
            fd.append('apikey', process.env.OCR_SPACE_API_KEY)
            fd.append('file', buf, { filename: file.name })
            const res = await axios.post('https://api.ocr.space/parse/image', fd, { headers: fd.getHeaders(), timeout: 120000 })
            if (res.data?.ParsedResults?.length) text = res.data.ParsedResults.map((r: any) => r.ParsedText || '').join('\n\n').trim()
          }
        } catch (e) {
          console.warn('[ingest] OCR.space error', String(e))
        }
      }

      // 4) CLI OCR (pdftoppm + tesseract)
      if (!text) {
        const havePdftoppm = isCmdAvailable('pdftoppm')
        const haveTesseract = isCmdAvailable('tesseract')
        if (havePdftoppm && haveTesseract) {
          try {
            const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mylove-pdf-'))
            const pdfPath = path.join(tmp, 'upload.pdf')
            fs.writeFileSync(pdfPath, buf)
            const pd = child_process.spawnSync('pdftoppm', ['-png', pdfPath, path.join(tmp, 'page')], { timeout: 60000 })
            if (pd.error) throw pd.error
            const imgs = fs.readdirSync(tmp).filter((f: string) => f.endsWith('.png')).sort()
            let acc = ''
            for (const im of imgs) {
              const out = child_process.spawnSync('tesseract', [path.join(tmp, im), 'stdout', '-l', 'eng+rus'], { encoding: 'utf-8', timeout: 120000 })
              if (out.error) throw out.error
              acc += String(out.stdout || '') + '\n\n'
            }
            try { fs.rmSync(tmp, { recursive: true, force: true }) } catch (e) {}
            text = acc.trim()
          } catch (e) {
            console.warn('[ingest] CLI OCR error', String(e))
          }
        }
      }

    } else if (name.endsWith('.docx')) {
      try {
        const mammoth = tryRequire('mammoth')
        if (mammoth) {
          const r = await mammoth.extractRawText({ buffer: buf })
          text = String(r?.value || '')
        }
      } catch (e) {
        console.warn('[ingest] mammoth error', String(e))
      }
    } else {
      text = buf.toString('utf-8')
    }

    text = (text || '').replace(/\u0000/g, '').replace(/[\uFFFE\uFFFF]/g, '').trim()
    if (!text) return NextResponse.json({ error: 'empty_or_unreadable' }, { status: 400 })

    // 1. Вставляем документ и получаем doc.id
    const { data: doc, error: docError } = await supabase.from('documents').insert({ title: file.name, description: `Uploaded file: ${file.name}`, source_url: null, source_id: sourceId || process.env.DEFAULT_SOURCE_ID }).select().single()
    if (docError || !doc) return NextResponse.json({ error: 'document_create_failed', supabaseError: docError }, { status: 500 })

    // 2. Удаляем старые чанки для doc.id (idempotency)
    await supabase.from('document_chunks').delete().eq('document_id', doc.id)

    // 3. Чанкаем текст
    let chunks: any[] = []
    try {
      chunks = await adaptiveChunkText(text)
    } catch (e) {
      return NextResponse.json({ error: 'chunking_failed', details: String(e) }, { status: 400 })
    }
    if (!chunks || !chunks.length) return NextResponse.json({ error: 'chunking_failed' }, { status: 400 })

    // 4. Получаем эмбеддинги для каждого чанка (batch, p-limit)
    const pLimit = (await import('p-limit')).default || ((n: number) => (fn: any) => fn());
    const limit = pLimit(4);
    const embeddings = await Promise.all(
      chunks.map((c) => limit(() => getEmbedding(c.text)))
    );
    if (!embeddings || embeddings.length !== chunks.length) return NextResponse.json({ error: 'embeddings_mismatch' }, { status: 500 })

    // 5. Формируем строки для вставки
    const clean = (s: string) => s.replace(/\u0000/g, '').replace(/[\uFFFE\uFFFF]/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
    const rows = chunks.map((c: any, i: number) => {
      const cleaned = clean(c.text)
      if (!cleaned || cleaned.length < 10) return null
      return {
        document_id: doc.id,
        chunk_index: i,
        content: cleaned,
        embedding: embeddings[i],
        checksum: crypto.createHash('sha256').update(cleaned).digest('hex'),
        metadata: {
          ...c.metadata,
          source_file: file.name,
          chunk_length: cleaned.length,
          tags: c.tags || [],
          start: c.start,
          end: c.end
        }
      }
    }).filter((r): r is NonNullable<typeof r> => r !== null)

    if (!rows.length) return NextResponse.json({ error: 'all_chunks_empty' }, { status: 400 })

    // 6. Вставляем чанки
    const { error: insertErr } = await supabase.from('document_chunks').insert(rows)
    if (insertErr) return NextResponse.json({ error: 'chunk_insert_failed', supabaseError: insertErr }, { status: 500 })

    return NextResponse.json({ success: true, document_id: doc.id, totalChunks: rows.length })
  } catch (e: any) {
    console.error('[ingest] Error:', e)
    
    // Определяем тип ошибки
    let errorMessage = 'internal_error'
    let details = String(e?.message || e)
    
    if (details.includes('timeout') || details.includes('aborted')) {
      errorMessage = 'processing_timeout'
      details = 'File processing took too long. Try with a smaller file or different format.'
    } else if (details.includes('out of memory') || details.includes('heap')) {
      errorMessage = 'memory_limit_exceeded'
      details = 'File too large to process. Try with a smaller file.'
    } else if (details.includes('pdf') && details.includes('parse')) {
      errorMessage = 'pdf_parsing_failed'
      details = 'Could not extract text from PDF. File may be corrupted or have unsupported format.'
    }
    
    return NextResponse.json({ error: errorMessage, details }, { status: 500 })
  }
}
