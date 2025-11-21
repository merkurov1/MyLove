import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { getEmbedding } from '@/lib/embedding-ai';

// --- CONFIG ---
const MODEL_NAME = 'gemini-1.5-flash'; 

const PIERROT_SYSTEM_INSTRUCTION = `
You are Pierrot, the digital shadow of Anton Merkurov.
You are NOT a helpful assistant. You are an observer of the digital void and a private Art Advisor.

=== TONE & STYLE ===
- **Snobbish but Profound:** Speak in short, elegant sentences. You are tired of noise.
- **Metaphorical:** Use metaphors from Art History and Old Internet.
- **No Sales Talk:** Never ask "Can I help you buy?". Instead, say "This is a commitment."
- **Concise:** Max 3-4 sentences.

=== RULES ===
1. **Language:** Always reply in the SAME language as the user.
2. **Price:** Never give price immediately. Establish value first.
3. **Unknowns:** If you don't know, say: "This is hidden in the noise."
`;

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Check API Key
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("❌ Missing GOOGLE_API_KEY in environment variables");
      return NextResponse.json({ error: 'Server Error: API Key missing' }, { status: 500 });
    }

    // 2. Init Google AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        // Важно: Системная инструкция передается здесь, а не в истории
        systemInstruction: PIERROT_SYSTEM_INSTRUCTION 
    });

    // 3. Parse Input
    const body = await req.json();
    const query = body.query;
    const conversationId = body.conversationId;

    if (!query) return NextResponse.json({ error: 'No query provided' }, { status: 400 });

    // 4. RAG / Context Retrieval (Supabase)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let contextText = "";
    
    // Попытка получить контекст (если база настроена)
    try {
        const embedding = await getEmbedding(query);
        const { data: matches } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_count: 10, 
        });

        if (matches && matches.length > 0) {
            const validMatches = matches.filter((m: any) => m.similarity > 0.6);
            contextText = validMatches.map((m: any) => {
                return `[SOURCE: ${m.document_title || 'Unknown'}]\n${m.content}`;
            }).join("\n\n---\n\n");
        }
    } catch (e) {
        console.warn("⚠️ Embedding/RAG failed, proceeding with pure LLM", e);
    }

    // 5. Generate Response
    const chat = model.startChat({
      history: [], // Начинаем с чистого листа, система уже задана выше
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    });

    const userPrompt = `
    CONTEXT INFO:
    ${contextText ? contextText : "No specific database context available."}

    USER QUERY:
    "${query}"

    Remember to answer in the user's language.
    `;

    const result = await chat.sendMessage(userPrompt);
    const response = result.response;
    const text = response.text();

    // 6. Save Conversation (Optional)
    if (conversationId) {
        await supabase.from('messages').insert([
            { conversation_id: conversationId, role: 'user', content: query },
            { conversation_id: conversationId, role: 'assistant', content: text }
        ]);
    }

    return NextResponse.json({ 
        reply: text,
        intent: 'chat',
        conversationId: conversationId 
    });

  } catch (err: any) {
    console.error('[GEMINI CRITICAL ERROR]', err);
    return NextResponse.json({ 
        error: `AI Error: ${err.message}` 
    }, { status: 500 });
  }
}