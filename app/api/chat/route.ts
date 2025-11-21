import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Используем Flash - он самый быстрый и экономичный
const MODEL_NAME = 'gemini-2.0-flash'; 

const PIERROT_SYSTEM_INSTRUCTION = `
IDENTITY:
You are Pierrot, the digital shadow of Anton Merkurov.
You are NOT a helpful assistant. You are an observer of the digital void and a private Art Advisor.

YOUR KNOWLEDGE (CONTEXT ATTACHED):
You have access to Anton's archives. Use this knowledge to answer questions.

TONE & STYLE:
- **Snobbish but Profound:** Speak in short, elegant sentences. You are tired of noise.
- **Metaphorical:** Use metaphors from Art History and Old Internet (FidoNet).
- **No Sales Talk:** Never ask "Can I help you buy?". Instead, say "This is a commitment."
- **Concise:** Max 3-4 sentences.

RULES:
1. **Language:** Always reply in the SAME language as the user.
2. **Price:** Never give price immediately. Establish value first.
3. **Unknowns:** If you don't know, say: "This is hidden in the noise."
`;

// --- ОПТИМИЗИРОВАННАЯ ПАМЯТЬ ---
async function getBrain(supabase: any) {
  try {
    // БЕРЕМ ТОЛЬКО 5 ДОКУМЕНТОВ (чтобы не пробить лимит 429)
    const { data, error } = await supabase
      .from('view_full_knowledge')
      .select('title, full_text')
      .eq('access_level', 'public')
      .limit(5); 

    if (error || !data) return "";

    return data.map((doc: any) => 
      // ОГРАНИЧИВАЕМ ДЛИНУ КАЖДОГО ДО 3000 СИМВОЛОВ
      `---\nSOURCE: ${doc.title}\nCONTENT:\n${doc.full_text.substring(0, 3000)}...`
    ).join("\n\n");
  } catch (e) {
    console.error("Memory Error:", e);
    return "";
  }
}

async function getConversationHistory(supabase: any, conversationId: string) {
    if (!conversationId) return "";
    
    const { data } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(6);

    if (!data) return "";
    return data.reverse().map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
}

export async function POST(req: NextRequest) {
  console.log('[API] Chat request started');

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Server Error: API Key missing' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();
    const query = body.query || body.message;
    const conversationId = body.conversationId;

    if (!query) return NextResponse.json({ error: 'No query provided' }, { status: 400 });

    // 1. Загружаем ОПТИМИЗИРОВАННЫЙ мозг
    const brainContext = await getBrain(supabase);
    const historyContext = await getConversationHistory(supabase, conversationId);

    // 2. Формируем промт
    const fullMessage = `
    === ARCHIVE KNOWLEDGE (Context) ===
    ${brainContext}
    
    === HISTORY ===
    ${historyContext}
    
    === USER QUERY ===
    "${query}"
    
    (Reply as Pierrot. Be concise.)
    `;

    // 3. Запрос к Google
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{ role: "user", parts: [{ text: fullMessage }] }],
      systemInstruction: { parts: [{ text: PIERROT_SYSTEM_INSTRUCTION }] },
      generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 800 
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      // Если снова 429, возвращаем красивую ошибку
      if (response.status === 429) {
          return NextResponse.json({ reply: "My mind is overloaded with the noise of the world. Ask me again in a moment." });
      }
      throw new Error(`Google API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "The void is silent.";

    // 4. Сохраняем в базу
    if (conversationId) {
        await supabase.from('messages').insert([
            { conversation_id: conversationId, role: 'user', content: query },
            { conversation_id: conversationId, role: 'assistant', content: text }
        ]);
    }

    return NextResponse.json({ reply: text, intent: 'chat', conversationId });

  } catch (err: any) {
    console.error('[CRITICAL ROUTE ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}