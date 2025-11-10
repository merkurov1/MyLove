import { NextRequest, NextResponse } from 'next/server'
// Defer optional heavy modules until runtime
const fs = require('fs')
const os = require('os')
const path = require('path')
const child_process = require('child_process')

// Helper to run pdftoppm and tesseract and capture outputs
function runCommand(cmd: string, args: string[], opts: any = {}) {
  try {
    const res = child_process.spawnSync(cmd, args, { encoding: 'utf-8', ...opts })
    return { status: res.status, stdout: res.stdout, stderr: res.stderr, error: res.error }
  } catch (e: any) {
    return { status: null, stdout: '', stderr: String(e.stack || e.message), error: e }
  }
}

function isCmdAvailable(cmd: string) {
  try {
    const res = child_process.spawnSync('which', [cmd], { encoding: 'utf-8' })
    return res.status === 0 && !!res.stdout
  } catch (e) {
    return false
  }
}

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuffer)

    const result: any = { filename: file.name, size: file.size }

    // 1) pdf-parse
    try {
      const tryRequire = (p: string) => {
        try {
          // eslint-disable-next-line no-eval
          return eval('require')(p)
        } catch (e) {
          return null
        }
      }

      const pdfParse = tryRequire('pdf-parse')
      if (pdfParse) {
        const pd = await pdfParse(buf)
        result.pdfParse = { ok: true, textSample: String(pd.text || '').slice(0, 2000), length: (pd.text||'').length }
      } else {
        result.pdfParse = { ok: false, error: 'pdf-parse module not available' }
      }
    } catch (err: any) {
      result.pdfParse = { ok: false, error: String(err.message || err), stack: err?.stack }
    }

        // 2) pdfjs-dist (load at runtime only to avoid bundler resolving optional module)
        try {
          const tryRequire = (p: string) => {
            try {
              // eslint-disable-next-line no-eval
              return eval('require')(p)
            } catch (e) {
              return null
            }
          }

          let pdfjsLib: any = tryRequire('pdfjs-dist/legacy/build/pdf.js')
          if (!pdfjsLib) pdfjsLib = tryRequire('pdfjs-dist')
          if (!pdfjsLib) {
            throw new Error('pdfjs-dist not available')
          }

          const loadingTask = pdfjsLib.getDocument({ data: buf })
          const pdf = await loadingTask.promise
          let full = ''
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            full += content.items.map((it: any) => it.str || '').join(' ') + '\n\n'
            if (full.length > 2000) break
          }
          result.pdfjs = { ok: true, textSample: full.slice(0, 2000), pages: pdf.numPages }
        } catch (err: any) {
          result.pdfjs = { ok: false, error: String(err.message || err), stack: err?.stack }
        }

  // 3) OCR fallback (pdftoppm + tesseract) but only if CLI present
    const havePdftoppm = isCmdAvailable('pdftoppm')
    const haveTesseract = isCmdAvailable('tesseract')
    result.ocrCli = { pdftoppm: havePdftoppm, tesseract: haveTesseract }

    if (havePdftoppm && haveTesseract) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mylove-debug-'))
      const pdfPath = path.join(tmpDir, 'upload.pdf')
      fs.writeFileSync(pdfPath, buf)
      const pdftoppmRes = runCommand('pdftoppm', ['-png', pdfPath, path.join(tmpDir, 'page')], { timeout: 60000 })
      result.pdftoppm = { status: pdftoppmRes.status, stderr: pdftoppmRes.stderr }
  const images = fs.readdirSync(tmpDir).filter((f: string) => f.endsWith('.png')).sort()
      if (images.length) {
        const first = images[0]
        const imgPath = path.join(tmpDir, first)
        const tesseractRes = runCommand('tesseract', [imgPath, 'stdout', '-l', 'eng+rus'], { timeout: 120000 })
        result.tesseract = { status: tesseractRes.status, stdoutSample: String(tesseractRes.stdout||'').slice(0,2000), stderr: tesseractRes.stderr }
      } else {
        result.tesseract = { status: null, error: 'no images produced by pdftoppm' }
      }
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch (e) {}
    } else {
      result.ocrSkipped = 'pdftoppm or tesseract missing on server'
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('ingest/debug error:', err)
    return NextResponse.json({ error: String(err.message || err), stack: err.stack }, { status: 500 })
  }
}
