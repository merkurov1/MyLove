import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasCohereKey: !!process.env.COHERE_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const { test } = await req.json()
    console.log(`[${new Date().toISOString()}] Test endpoint called with:`, test)

    return NextResponse.json({
      success: true,
      message: `Test received: ${test}`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Test endpoint error:`, error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}