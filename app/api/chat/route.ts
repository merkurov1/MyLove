import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEmbedding } from '@/lib/embedding-ai';

export const runtime = 'nodejs';

// --- CONFIG ---
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

export async function POST(req: NextRequest) {
  console.log('[API] Chat request started');

  try {
    // 1. Check API Key
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("❌ Missing GOOGLE_API_KEY");
      return NextResponse.json({ error: 'Server Error: API Key missing' }, { status: 500 });
    }

    // 2. Parse Input
    const body = await req.json();
    const query = body.query;
    const conversationId = body.conversationId;

    if (!query) return NextResponse.json({ error: 'No query provided' }, { status: 400 });

    // 3. RAG / Context Retrieval (Supabase)
    let contextText = "";
    try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const embedding = await getEmbedding(query);
        const { data: matches } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_count: 8, // Берем 8 лучших кусков
        });

        if (matches && matches.length > 0) {
            const validMatches = matches.filter((m: any) => m.similarity > 0.6);
            contextText = validMatches.map((m: any) => {
                return `[SOURCE: ${m.document_title || 'Unknown'}]\n${m.content}`;
            }).join("\n\n---\n\n");
        }
    } catch (e) {
        console.warn("⚠️ RAG skipped (DB error or no embedding)", e);
    }

    // 4. Prepare Payload for Google API (REST format)
    const userMessage = `
    CONTEXT FROM DATABASE:
    ${contextText || "No database context available."}

    USER QUERY:
    "${query}"

    (Remember: Be Pierrot. Answer in user's language.)
    `;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }]
        }
      ],
      systemInstruction: {
        parts: [{ text: PIERROT_SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    };

    // 5. Direct Fetch to Gemini 1.5 Flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GOOGLE API ERROR]', errorText);
      return NextResponse.json({ error: `Google API Error: ${response.status} ${response.statusText}` }, { status: 500 });
    }

    const data = await response.json();
    
    // Extract text from Google's response structure
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "The void is silent today. (Error parsing response)";

    // 6. Save to DB (Fixed Types)
    if (conversationId) {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        // Исправлена ошибка типов: добавлено : any
        supabase.from('messages').insert([
            { conversation_id: conversationId, role: 'user', content: query },
            { conversation_id: conversationId, role: 'assistant', content: text }
        ]).then(({ error }: any) => {
            if (error) console.error('Failed to save message', error);
        });
    }

    return NextResponse.json({ 
        reply: text,
        intent: 'chat',
        conversationId: conversationId 
    });

  } catch (err: any) {
    console.error('[CRITICAL ROUTE ERROR]', err);
    return NextResponse.json({ error: `Internal Error: ${err.message}` }, { status: 500 });
  }
}