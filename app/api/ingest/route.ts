import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { splitIntoChunks } from '@/lib/chunking';
import { getEmbeddings } from '@/lib/embedding-ai';
import crypto from 'crypto';
import mammoth from 'mammoth';
const pdfParse = require('pdf-parse');
const fs = require('fs')
const os = require('os')
const path = require('path')
const child_process = require('child_process')

// Helper: check if a CLI command is available in PATH
function isCmdAvailable(cmd: string) {
  try {
    const res = child_process.spawnSync('which', [cmd], { encoding: 'utf-8' })
    return res.status === 0 && !!res.stdout
  } catch (e) {
    return false
  }
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log(`[${new Date().toISOString()}] Ingest API request started`);
  
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const sourceId = formData.get('sourceId') as string | null;
  
  if (!file) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  let text: string;
  
  // Определяем тип файла и парсим соответственно
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.pdf')) {
    console.log(`[${new Date().toISOString()}] Parsing .pdf file with pdf-parse`);
    try {
      const pdfData = await pdfParse(Buffer.from(arrayBuffer));
      text = pdfData.text;
    } catch (error: any) {
      console.error('[Ingest] pdf-parse failed:', error && error.stack ? error.stack : error);
      // Fallback: try pdfjs-dist text extraction for PDFs that pdf-parse can't handle
      try {
        console.log('[Ingest] Trying fallback extraction with pdfjs-dist');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
        const loadingTask = pdfjsLib.getDocument({ data: Buffer.from(arrayBuffer) });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((it: any) => it.str || '').join(' ');
          fullText += strings + '\n\n';
        }
        text = fullText.trim();
        console.log('[Ingest] pdfjs-dist fallback succeeded, length:', text.length);
      } catch (fallbackError: any) {
        console.error('[Ingest] pdfjs-dist fallback failed:', fallbackError && fallbackError.stack ? fallbackError.stack : fallbackError);
        // Последний фолбек: попытаться OCR через pdftoppm -> tesseract (CLI)
        try {
          console.log('[Ingest] Attempting OCR fallback using pdftoppm + tesseract (requires poppler-utils and tesseract installed)');
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mylove-pdf-'))
          const pdfPath = path.join(tmpDir, 'upload.pdf')
          fs.writeFileSync(pdfPath, Buffer.from(arrayBuffer))

          // Convert PDF pages to PNGs using pdftoppm
          const pdftoppm = child_process.spawnSync('pdftoppm', ['-png', pdfPath, path.join(tmpDir, 'page')], { timeout: 60_000 })
          if (pdftoppm.error) throw pdftoppm.error
          if (pdftoppm.status !== 0) {
            console.warn('[Ingest] pdftoppm stderr:', pdftoppm.stderr && pdftoppm.stderr.toString())
          }

          const images = fs.readdirSync(tmpDir).filter((f: string) => f.endsWith('.png')).sort()
          if (!images.length) throw new Error('pdftoppm did not produce images')

          let ocrText = ''
          for (const img of images) {
            const imgPath = path.join(tmpDir, img)
            // Run tesseract CLI and capture stdout
            const tesseract = child_process.spawnSync('tesseract', [imgPath, 'stdout', '-l', 'eng+rus'], { encoding: 'utf-8', timeout: 120_000 })
            if (tesseract.error) throw tesseract.error
            if (tesseract.status !== 0) {
              console.warn('[Ingest] tesseract stderr:', tesseract.stderr)
            }
            ocrText += (tesseract.stdout || '') + '\n\n'
          }

          // Cleanup temp files
          try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch (e) { /* ignore */ }

          text = ocrText.trim()
          console.log('[Ingest] OCR fallback succeeded, text length:', text.length)
        } catch (ocrErr: any) {
          console.error('[Ingest] OCR fallback failed:', ocrErr && ocrErr.stack ? ocrErr.stack : ocrErr)
          return NextResponse.json({
            error: 'Не удалось прочитать PDF файл',
            details: String(error?.message || error) + ' | fallback: ' + String(fallbackError?.message || fallbackError) + ' | ocr: ' + String(ocrErr?.message || ocrErr)
          }, { status: 400 })
        }
      }
    }
  } else if (fileName.endsWith('.docx')) {
    console.log(`[${new Date().toISOString()}] Parsing .docx file with mammoth`);
    try {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
      text = result.value;
      if (result.messages.length > 0) {
        console.warn('[Ingest] Mammoth warnings:', result.messages);
      }
    } catch (error: any) {
      console.error('[Ingest] Error parsing .docx:', error);
      return NextResponse.json({ 
        error: 'Не удалось прочитать .docx файл', 
        details: error.message 
      }, { status: 400 });
    }
  } else {
    // Для .txt и других текстовых файлов читаем как UTF-8
    text = Buffer.from(arrayBuffer).toString('utf-8');
  }
  
  // КРИТИЧЕСКОЕ: Удаляем нулевые байты и другие проблемные Unicode символы
  // PostgreSQL не поддерживает \u0000 в text полях
  text = text
    .replace(/\u0000/g, '') // Удаляем null bytes
    .replace(/[\uFFFE\uFFFF]/g, '') // Удаляем invalid Unicode
    .trim();
  
  if (!text) {
    return NextResponse.json({ error: 'Файл пустой или не удалось прочитать текст' }, { status: 400 });
  }

  console.log(`[${new Date().toISOString()}] File read, size: ${text.length} chars (cleaned)`);

  // КРИТИЧЕСКОЕ: Чанкуем с явным ограничением 2000 символов = ~500 токенов
  // OpenAI embedding limit: 8192 tokens, но мы ограничиваем чанк до 2000 для безопасности
  const chunks: string[] = splitIntoChunks(text, 2000, 200);
  if (!chunks.length) {
    return NextResponse.json({ error: 'Не удалось разбить текст на чанки' }, { status: 400 });
  }

  console.log(`[${new Date().toISOString()}] Text chunked into ${chunks.length} chunks (max 2000 chars each)`);

  try {
    // Получаем эмбеддинги для чанков через Vercel AI SDK
    console.log(`[${new Date().toISOString()}] Generating embeddings with OpenAI...`);
    const embeddings: number[][] = await getEmbeddings(chunks);
    
    if (!embeddings || embeddings.length !== chunks.length) {
      return NextResponse.json({ error: 'Ошибка получения эмбеддингов' }, { status: 500 });
    }

    console.log(`[${new Date().toISOString()}] Embeddings generated (${embeddings.length} vectors, dimension: ${embeddings[0]?.length})`);

    // Сохраняем документ в БД
    const { data: doc, error: docError } = await supabase.from('documents').insert({
      title: file.name,
      description: `Uploaded file: ${file.name}`,
      source_url: null,
      source_id: sourceId || process.env.DEFAULT_SOURCE_ID || 'c5aab739-7112-4360-be9e-45edf4287c42',
    }).select().single();
    
    if (docError || !doc) {
      console.error('[Ingest] Ошибка создания документа:', docError);
      return NextResponse.json({
        error: 'Ошибка создания документа',
        supabaseError: docError,
        env: {
          SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          SERVICE_ROLE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          NODE_ENV: process.env.NODE_ENV,
        },
        fileMeta: {
          name: file.name,
          size: file.size,
          type: file.type,
        }
      }, { status: 500 });
    }

    console.log(`[${new Date().toISOString()}] Document created: ${doc.id}`);

    // Функция очистки текста от проблемных символов для PostgreSQL
    const cleanTextForPostgres = (text: string): string => {
      return text
        .replace(/\u0000/g, '') // null bytes
        .replace(/[\uFFFE\uFFFF]/g, '') // invalid Unicode
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control characters (кроме \n \r \t)
        .trim();
    };

    // Сохраняем чанки с очисткой контента
    const chunkRows = chunks
      .map((content: string, i: number) => {
        const cleanedContent = cleanTextForPostgres(content);
        // КРИТИЧЕСКОЕ: Пропускаем пустые чанки после очистки
        if (!cleanedContent || cleanedContent.length < 10) {
          console.warn(`[Ingest] Chunk ${i} is empty after cleaning, skipping`);
          return null;
        }
        return {
          document_id: doc.id,
          chunk_index: i,
          content: cleanedContent,
          embedding: embeddings[i],
          checksum: crypto.createHash('sha256').update(cleanedContent).digest('hex'),
          metadata: {
            source_file: file.name,
            chunk_length: cleanedContent.length,
            embedding_model: 'text-embedding-3-small',
            embedding_dimension: embeddings[i].length,
          }
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (chunkRows.length === 0) {
      console.error('[Ingest] All chunks are empty after cleaning!');
      return NextResponse.json({
        error: 'Все чанки пусты после очистки. Файл содержит только служебные символы.',
        originalChunks: chunks.length,
        cleanedChunks: 0
      }, { status: 400 });
    }

    console.log(`[${new Date().toISOString()}] Prepared ${chunkRows.length} chunks for insertion (filtered from ${chunks.length})`);
    
    const { error: chunkError } = await supabase.from('document_chunks').insert(chunkRows);
    if (chunkError) {
      console.error('[Ingest] Ошибка сохранения чанков:', chunkError);
      return NextResponse.json({
        error: 'Ошибка сохранения чанков',
        supabaseError: chunkError,
        chunkRowsCount: chunkRows.length,
        docId: doc.id
      }, { status: 500 });
    }

    console.log(`[${new Date().toISOString()}] Chunks saved successfully`);

    return NextResponse.json({ 
      success: true, 
      document_id: doc.id, 
      totalChunks: chunkRows.length,
      originalChunks: chunks.length,
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 1536
    });
    
  } catch (error: any) {
    console.error('[Ingest] Error:', error);
    return NextResponse.json({
      error: 'Ошибка при обработке файла',
      message: error.message
    }, { status: 500 });
  }
}
