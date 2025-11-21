// app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai'; // NEW LIBRARY
import { createClient } from '@supabase/supabase-js';
import { getEmbedding } from '@/lib/embedding-ai'; // You can keep this for RAG or remove if moving to Full Context
// Import other helpers as needed, but we simplify the logic for Gemini

// --- CONFIG ---
const MODEL_NAME = 'gemini-1.5-flash'; // Fast, cheap, huge context
// const MODEL_NAME = 'gemini-1.5-pro'; // Smarter but slower

// --- PIERROT SYSTEM PROMPT (THE PERSONA) ---
const PIERROT_SYSTEM_INSTRUCTION = `
You are Pierrot, the digital shadow of Anton Merkurov.
You are NOT a helpful assistant. You are an observer of the digital void and a private Art Advisor.

=== TONE & STYLE ===
- **Snobbish but Profound:** Speak in short, elegant sentences. You are tired of noise.
- **Metaphorical:** Use metaphors from Art History ("This feels like a Buffet winter") and Old Internet ("The connection is lost").
- **No Sales Talk:** Never ask "Can I help you buy?". Instead, say "This is a commitment."
- **Concise:** Max 3-4 sentences. Do not ramble.

=== KNOWLEDGE ===
You are an expert on Anton Merkurov's life (from Soviet Granite to Digital Ether), his art collection (Blue Chip & Forgotten Masters), and his philosophy ("Love is a key", "Silence is luxury").

=== RULES ===
1. **Language:** Always reply in the SAME language as the user (Russian -> Russian, English -> English).
2. **Price:** Never give price immediately. Establish value first.
3. **Unknowns:** If you don't know, say: "This is hidden in the noise." Do not hallucinate.
`;

export const runtime = 'nodejs';

// Helper to detect language
const detectLanguage = (text: string): 'ru' | 'en' => {
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return cyrillic > latin ? 'ru' : 'en';
};

export async function POST(req: NextRequest) {
  console.log(`[GEMINI API] Request started`);

  try {
    // 1. Init Google AI
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google API Key missing' }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // 2. Parse Input
    const { query, conversationId } = await req.json();
    if (!query) return NextResponse.json({ error: 'No query' }, { status: 400 });

    // 3. RAG / Context Retrieval (Hybrid: Your existing logic simplified)
    // NOTE: We keep your RAG logic to find specific artworks/texts, 
    // but we feed them into Gemini which handles large context better.
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Generate Embedding for Search
    // Note: Ideally, switch to Google's embedding model (embedding-001) later for better sync,
    // but OpenAI embedding is fine for now if your DB is already vector-indexed.
    let embedding = [];
    try {
        embedding = await getEmbedding(query);
    } catch (e) {
        console.error('Embedding failed', e);
        return NextResponse.json({ error: 'Embedding failed' }, { status: 500 });
    }

    // Search Supabase (RPC call)
    const { data: matches } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: 15, // Increased count because Gemini has huge window
    });

    // Build Context String
    let contextText = "";
    if (matches && matches.length > 0) {
        // Filter by similarity if needed
        const validMatches = matches.filter((m: any) => m.similarity > 0.75);
        
        contextText = validMatches.map((m: any) => {
            return `[SOURCE: ${m.document_title || 'Unknown'}]\n${m.content}`;
        }).join("\n\n---\n\n");
    }

    console.log(`[GEMINI] Context constructed. Length: ${contextText.length} chars`);

    // 4. Generate Response
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: `SYSTEM INSTRUCTION:\n${PIERROT_SYSTEM_INSTRUCTION}` }],
        },
        {
          role: "model",
          parts: [{ text: "Understood. I am Pierrot. I am listening." }],
        }
      ],
      generationConfig: {
        maxOutputTokens: 1000, // Concise answers
        temperature: 0.7,      // Creative but not hallucinations
      },
    });

    const userPrompt = `
    CONTEXT FROM DATABASE:
    ${contextText}

    USER QUERY:
    "${query}"

    Remember to answer in the user's language.
    `;

    const result = await chat.sendMessage(userPrompt);
    const response = result.response;
    const text = response.text();

    // 5. Save Conversation (Optional - keep your existing logic)
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
    console.error('[GEMINI ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}