import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MODEL_NAME = 'gemini-1.5-flash'; // Быстрая, дешевая, надежная

const PIERROT_SYSTEM_INSTRUCTION = `
IDENTITY:
You are Pierrot, the digital shadow of Anton Merkurov.
You are NOT a helpful assistant. You are an observer of the digital void and a private Art Advisor.

YOUR KNOWLEDGE (CONTEXT ATTACHED):
Below are excerpts from Anton's archives (articles, newsletters, art descriptions).
Use them to answer accurately. 
- If the context contains specific artworks (e.g. Monet, Bromley), discuss them.
- If it contains philosophy (Substack), quote it.

TONE & STYLE:
- **Snobbish but Profound:** Speak in short, elegant sentences.
- **No Sales Talk:** Never ask "Can I help you buy?".
- **Concise:** Max 3-4 sentences.

RULES:
1. **Language:** Always reply in the SAME language as the user (Russian or English).
2. **Unknowns:** If the answer is not in the context, say: "This memory is lost in the noise."
`;

// --- УПРОЩЕННЫЙ И НАДЕЖНЫЙ ПОИСК ---
async function getBrain(supabase: any, userQuery: string) {
  try {
    // 1. Выделяем самое длинное слово из запроса (как ключевое)
    // Например: "Что там про Моне?" -> ищем "Моне"
    const words = userQuery.split(' ').filter(w => w.length > 3);
    const keyword = words.length > 0 ? words[0] : null;

    let query = supabase
      .from('view_full_knowledge')
      .select('title, full_text')
      .eq('access_level', 'public');

    // 2. Если есть ключевое слово - ищем по нему (простое совпадение)
    if (keyword) {
       query = query.ilike('full_text', `%${keyword}%`);
    }
    
    // 3. Берем топ-3 результата
    const { data, error } = await query.limit(3);

    // Если ничего не нашли по слову (или ошибка), берем просто последние 3 записи (Fallback)
    if (!data || data.length === 0) {
        const { data: recentData } = await supabase
            .from('view_full_knowledge')
            .select('title, full_text')
            .eq('access_level', 'public')
            .limit(3);
        
        if (recentData) {
             return recentData.map((doc: any) => 
                `---\nSOURCE: ${doc.title}\nCONTENT:\n${doc.full_text.substring(0, 2500)}`
            ).join("\n\n");
        }
        return "";
    }

    return data.map((doc: any) => 
      `---\nSOURCE: ${doc.title}\nCONTENT:\n${doc.full_text.substring(0, 2500)}`
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
    if (!apiKey) return NextResponse.json({ error: 'API Key missing' }, { status: 500 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();
    const query = body.query || body.message;
    const conversationId = body.conversationId;

    if (!query) return NextResponse.json({ error: 'No query' }, { status: 400 });

    // 1. Достаем знания (используя надежный ILIKE поиск)
    const brainContext = await getBrain(supabase, query);
    const historyContext = await getConversationHistory(supabase, conversationId);

    const fullMessage = `
    === ARCHIVE KNOWLEDGE (Context) ===
    ${brainContext}
    
    === HISTORY ===
    ${historyContext}
    
    === USER QUERY ===
    "${query}"
    
    (Reply as Pierrot. Use the context provided.)
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{ role: "user", parts: [{ text: fullMessage }] }],
      systemInstruction: { parts: [{ text: PIERROT_SYSTEM_INSTRUCTION }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        if (response.status === 429) {
            return NextResponse.json({ reply: "My memory is overloaded. Silence is required for a moment.", conversationId });
        }
        const errText = await response.text();
        throw new Error(`Google Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "...";

    if (conversationId) {
        await supabase.from('messages').insert([
            { conversation_id: conversationId, role: 'user', content: query },
            { conversation_id: conversationId, role: 'assistant', content: text }
        ]);
    }

    return NextResponse.json({ reply: text, intent: 'chat', conversationId });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ reply: "Connection disrupted." }, { status: 200 });
  }
}