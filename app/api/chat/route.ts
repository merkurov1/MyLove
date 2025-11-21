import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ИЗ ТВОЕГО СПИСКА: models/gemini-2.0-flash
const MODEL_NAME = 'gemini-2.0-flash';

const PIERROT_SYSTEM_INSTRUCTION = `
IDENTITY:
You are Pierrot, the digital shadow of Anton Merkurov.
You are NOT a helpful assistant. You are an observer of the digital void and a private Art Advisor.

YOUR KNOWLEDGE (CONTEXT ATTACHED):
Below are excerpts from Anton's archives relevant to the user's question.
Use them to answer accurately. 
- If the context contains specific artworks (e.g. Monet, Bromley), discuss them.
- If it contains philosophy, quote it.

TONE & STYLE:
- **Snobbish but Profound:** Speak in short, elegant sentences.
- **Metaphorical:** Use metaphors from Art History and Old Internet.
- **No Sales Talk:** Never ask "Can I help you buy?".
- **Concise:** Max 3-4 sentences.

RULES:
1. **Language:** Always reply in the SAME language as the user.
2. **Price:** Never give price immediately.
3. **Unknowns:** If the answer is not in the context, say: "This memory is lost in the noise."
`;

// --- ПОИСК ЗНАНИЙ ---
async function getBrain(supabase: any, userQuery: string) {
  try {
    // 1. Ищем ключевое слово (длиннее 3 букв)
    const words = userQuery.split(' ').filter(w => w.length > 3);
    const keyword = words.length > 0 ? words[0] : null;

    let query = supabase
      .from('view_full_knowledge')
      .select('title, full_text')
      .eq('access_level', 'public');

    if (keyword) {
       // Простой поиск по совпадению
       query = query.ilike('full_text', `%${keyword}%`);
    }
    
    // Берем топ-3 релевантных
    const { data, error } = await query.limit(3);

    // Если не нашли, берем просто последние 3 (чтобы бот не молчал)
    if (!data || data.length === 0) {
        const { data: recentData } = await supabase
            .from('view_full_knowledge')
            .select('title, full_text')
            .eq('access_level', 'public')
            .limit(3);
        
        if (recentData) {
             return recentData.map((doc: any) => 
                `---\nSOURCE: ${doc.title}\nCONTENT:\n${doc.full_text.substring(0, 3000)}`
            ).join("\n\n");
        }
        return "";
    }

    return data.map((doc: any) => 
      `---\nSOURCE: ${doc.title}\nCONTENT:\n${doc.full_text.substring(0, 3000)}`
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
        .limit(4);
    if (!data) return "";
    return data.reverse().map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('API Key missing');

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();
    const query = body.query || body.message;
    const conversationId = body.conversationId;

    if (!query) throw new Error('No query');

    // 1. Грузим контекст
    const brainContext = await getBrain(supabase, query);
    const historyContext = await getConversationHistory(supabase, conversationId);

    const fullMessage = `
    === ARCHIVE KNOWLEDGE ===
    ${brainContext}
    
    === HISTORY ===
    ${historyContext}
    
    === USER QUERY ===
    "${query}"
    
    (Reply as Pierrot.)
    `;

    // 2. Запрос к Google
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{ role: "user", parts: [{ text: fullMessage }] }],
      systemInstruction: { parts: [{ text: PIERROT_SYSTEM_INSTRUCTION }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        // Если 429 - выводим красивую заглушку
        if (response.status === 429) {
            return NextResponse.json({ reply: "My mind is overloaded with the noise of the world. Try again in a moment.", conversationId });
        }
        // Если другая ошибка - кидаем её, чтобы видеть в логах
        throw new Error(`Google Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "The void is silent.";

    // 3. Сохраняем
    if (conversationId) {
        await supabase.from('messages').insert([
            { conversation_id: conversationId, role: 'user', content: query },
            { conversation_id: conversationId, role: 'assistant', content: text }
        ]);
    }

    return NextResponse.json({ reply: text, intent: 'chat', conversationId });

  } catch (err: any) {
    console.error("API ROUTE ERROR:", err);
    // Возвращаем ошибку во фронт, чтобы ты увидел её сразу, если что-то пойдет не так
    return NextResponse.json({ reply: `⚠️ System Error: ${err.message}` }, { status: 200 });
  }
}