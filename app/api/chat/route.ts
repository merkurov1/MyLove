import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MODEL_NAME = 'gemini-1.5-flash'; 

export async function POST(req: NextRequest) {
  try {
    // 1. ПРОВЕРКА КЛЮЧЕЙ
    const apiKey = process.env.GOOGLE_API_KEY;
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!apiKey) throw new Error("Missing GOOGLE_API_KEY");
    if (!sbUrl || !sbKey) throw new Error("Missing SUPABASE keys");

    const supabase = createClient(sbUrl, sbKey);
    const body = await req.json();
    const query = body.query || body.message;
    const conversationId = body.conversationId;

    if (!query) throw new Error("No query in body");

    // 2. ТЕСТ БАЗЫ ДАННЫХ (Прямой запрос без логики поиска)
    // Просто берем 2 последних публичных документа, чтобы проверить связь
    const { data: docs, error: dbError } = await supabase
      .from('view_full_knowledge')
      .select('title, full_text')
      .eq('access_level', 'public')
      .limit(2);

    if (dbError) throw new Error(`Supabase Error: ${dbError.message}`);
    
    const brainContext = docs && docs.length > 0 
      ? docs.map((d: any) => `SOURCE: ${d.title}\nTEXT: ${d.full_text.substring(0, 1000)}`).join('\n\n') 
      : "No knowledge found in DB.";

    // 3. ТЕСТ GOOGLE API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{ 
        role: "user", 
        parts: [{ text: `Context:\n${brainContext}\n\nUser question: ${query}\n\nAnswer as Pierrot (snobbish art advisor).` }] 
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Google returned empty response");

    // 4. УСПЕХ
    // Сохраняем диалог
    if (conversationId) {
        await supabase.from('messages').insert([
            { conversation_id: conversationId, role: 'user', content: query },
            { conversation_id: conversationId, role: 'assistant', content: text }
        ]);
    }

    return NextResponse.json({ reply: text, intent: 'chat', conversationId });

  } catch (err: any) {
    // ВЫВОДИМ ОШИБКУ ПРЯМО В ЧАТ
    return NextResponse.json({ 
      reply: `⚠️ DEBUG ERROR:\n${err.message}\n\nCheck Vercel logs for stack trace.` 
    }, { status: 200 });
  }
}