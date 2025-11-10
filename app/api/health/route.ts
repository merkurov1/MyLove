import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const runtime = 'nodejs'

function checkCmd(cmd: string) {
  try {
    const out = execSync(`which ${cmd}`, { stdio: 'pipe' }).toString().trim()
    return !!out
  } catch (e) {
    return false
  }
}

export function GET() {
  const pdftoppm = checkCmd('pdftoppm')
  const tesseract = checkCmd('tesseract')

  // Use runtime-resolution to avoid build-time bundler attempts to resolve optional modules
  let pdfParseAvailable = true
  try { // eslint-disable-next-line no-eval
    eval('require.resolve')('pdf-parse')
  } catch (e) { pdfParseAvailable = false }

  let pdfjsAvailable = true
  try { // eslint-disable-next-line no-eval
    eval('require.resolve')('pdfjs-dist')
  } catch (e) { pdfjsAvailable = false }

  return NextResponse.json({
    ok: true,
    pdftoppm,
    tesseract,
    pdfParseAvailable,
    pdfjsAvailable,
    supabaseServiceRoleSet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    note: 'If OCR is required in production, ensure pdftoppm (poppler-utils) and tesseract are installed, or provide an alternative OCR service.'
  })
}
