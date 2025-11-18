const { openai, createOpenAI } = require('@ai-sdk/openai');

// create client instance using env API key so we can access callable methods
const openaiClient = (typeof createOpenAI === 'function') ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }) : (openai || {});

/**
 * Adaptive semantic chunking (chunking-v2) - CommonJS version
 * Uses gpt-4o-mini to split text into semantically meaningful chunks.
 */

const MAX_CHARS_PER_CALL = 8000;

function splitToBlocks(text, maxChars = MAX_CHARS_PER_CALL) {
  if (!text) return [];
  const blocks = [];
  for (let i = 0; i < text.length; i += maxChars) {
    blocks.push(text.slice(i, i + maxChars));
  }
  return blocks;
}

async function sendPromptToLLM(prompt) {
  const client = openaiClient || openai;
  // responses.create
  if (client && client.responses && typeof client.responses.create === 'function') {
    const r = await client.responses.create({ model: 'gpt-4o-mini', input: prompt, max_output_tokens: 4000 });
    if (process.env.DEBUG_CHUNKING === '1') {
      try {
        console.log('---SDK_RESPONSES_CREATE_RAW---');
        console.log(typeof r === 'string' ? r.slice(0, 2000) : JSON.stringify(r).slice(0, 2000));
        console.log('---SDK_RESPONSES_CREATE_END---');
      } catch (e) {
        console.log('---SDK_RESPONSES_CREATE_FAILED_TO_PRINT---', e && e.message || e);
      }
    }
    // extract text robustly from the SDK response object
    const textFromSdk = extractTextFromResponse(r);
    const incomplete = !!(r && (r.status === 'incomplete' || r.incomplete_details));
    return { text: textFromSdk || '', incomplete };
  }

    // Helper: extract text from various Response shapes returned by SDK/HTTP
    function extractTextFromResponse(obj) {
      try {
        if (!obj) return '';
        // direct output_text
        if (typeof obj.output_text === 'string' && obj.output_text.trim().length > 0) return obj.output_text;

        // top-level 'text' fields
        if (typeof obj.text === 'string' && obj.text.trim()) return obj.text;

        // OpenAI Responses API: output is an array of messages
        if (Array.isArray(obj.output)) {
          const parts = [];
          for (const item of obj.output) {
            if (!item) continue;
            // item may be a string
            if (typeof item === 'string') { parts.push(item); continue; }
            // item.content may be array
            if (Array.isArray(item.content)) {
              for (const c of item.content) {
                if (!c) continue;
                if (typeof c === 'string') { parts.push(c); continue; }
                if (typeof c.text === 'string') parts.push(c.text);
                if (typeof c.content === 'string') parts.push(c.content);
                if (Array.isArray(c.items)) {
                  for (const it of c.items) if (it && typeof it.text === 'string') parts.push(it.text);
                }
              }
              continue;
            }
            // fallback fields
            if (typeof item.text === 'string') parts.push(item.text);
            if (typeof item.output_text === 'string') parts.push(item.output_text);
          }
          if (parts.length) return parts.join('\n');
        }

        // Chat completions shape
        if (Array.isArray(obj.choices)) {
          const cs = obj.choices.map(c => c?.message?.content || c?.text).filter(Boolean);
          if (cs.length) return cs.join('\n');
        }

        // nested output in 'output' as messages containing content arrays (older shapes)
        if (obj.output && typeof obj.output === 'object') {
          // try to stringify the output field's content if present
          try {
            return JSON.stringify(obj.output);
          } catch (e) {}
        }

        return '';
      } catch (e) {
        return '';
      }
    }

  // chat.completions.create
  if (client && client.chat && client.chat.completions && typeof client.chat.completions.create === 'function') {
    const r = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 4000 });
    const text = r.choices?.map(c => c.message?.content || c.text).filter(Boolean).join('\n');
    const incomplete = !!(r && (r.status === 'incomplete' || r.incomplete_details));
    return { text: text || '', incomplete };
  }

  // older chat.create shape
  if (client && client.chat && typeof client.chat.create === 'function') {
    const r = await client.chat.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 4000 });
    const textFromSdk = extractTextFromResponse(r);
    const incomplete = !!(r && (r.status === 'incomplete' || r.incomplete_details));
    return { text: textFromSdk || '', incomplete };
  }

  // If no SDK methods matched, try HTTP fallback before failing
  try {
    return await sendPromptToLLM_viaHttp(prompt);
  } catch (e) {
    throw new Error('No compatible OpenAI client available and HTTP fallback failed: ' + (e && e.message || e));
  }
}

// HTTP fallback: call OpenAI Responses API or Chat Completions directly using fetch
// Safe fetch: use global.fetch if present, otherwise try node-fetch (if installed)
const _fetch = (typeof global !== 'undefined' && global.fetch) ? global.fetch : (function () {
  try {
    return require('node-fetch');
  } catch (e) {
    return null;
  }
})();

async function sendPromptToLLM_viaHttp(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  if (!_fetch) throw new Error('No fetch available in this Node runtime. Install node-fetch or use Node 18+');

  // Try Responses API first
  try {
    const res = await _fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', input: prompt, max_output_tokens: 2000 })
    });
    if (process.env.DEBUG_CHUNKING === '1') {
      try {
        console.log('---HTTP_RESPONSES_STATUS---', res.status);
        const hdrs = {};
        try { for (const [k,v] of res.headers.entries()) hdrs[k]=v } catch(e){}
        console.log('---HTTP_RESPONSES_HEADERS---', JSON.stringify(hdrs).slice(0,2000));
      } catch (e) {
        console.log('---HTTP_RESPONSES_HEADER_PRINT_FAILED---', e && e.message || e);
      }
    }
    const j = await res.text();
    if (process.env.DEBUG_CHUNKING === '1') {
      try {
        console.log('---HTTP_RESPONSES_BODY_START---');
        console.log(j.length > 2000 ? j.slice(0,2000) + '\n...[truncated]' : j);
        console.log('---HTTP_RESPONSES_BODY_END---');
      } catch (e) {
        console.log('---HTTP_RESPONSES_BODY_PRINT_FAILED---', e && e.message || e);
      }
    }
    let parsed;
    try { parsed = JSON.parse(j); } catch(e) { parsed = null }
    if (parsed) {
      const text = extractTextFromResponse(parsed);
      const incomplete = !!(parsed && (parsed.status === 'incomplete' || parsed.incomplete_details));
      return { text: text || JSON.stringify(parsed), incomplete };
    }
    // if body wasn't JSON or empty, fall through to chat endpoint
  } catch (e) {
    // continue to chat endpoint
  }

  // Try Chat Completions
  try {
    const res2 = await _fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 2000 })
    });
    const j2 = await res2.json();
    const text = j2.choices?.[0]?.message?.content || j2.choices?.[0]?.text || JSON.stringify(j2);
    const incomplete = !!(j2 && (j2.status === 'incomplete' || j2.incomplete_details));
    return { text: text || '', incomplete };
  } catch (e) {
    throw new Error('HTTP fallback to OpenAI failed: ' + (e && e.message || e));
  }
}

// Try to recover a JSON array from a text blob. Returns array or null
function parseJsonArrayFromText(text) {
  if (!text || typeof text !== 'string') return null;
  let candidate = text.trim();
  // strip triple backtick fences if present
  candidate = candidate.replace(/^```\w*\n/, '');
  candidate = candidate.replace(/\n```$/, '');
  // find first '[' and last ']' and try to parse
  const first = candidate.indexOf('[');
  const last = candidate.lastIndexOf(']');
  if (first >= 0 && last > first) {
    const slice = candidate.slice(first, last + 1);
    try { const parsed = JSON.parse(slice); if (Array.isArray(parsed)) return parsed; } catch (e) {}
  }
  // fallback: try to extract all top-level objects and parse them individually
  const objs = [];
  try {
    const re = /\{[\s\S]*?\}/g;
    let m;
    while ((m = re.exec(candidate)) !== null) {
      try { const o = JSON.parse(m[0]); objs.push(o); } catch (e) { /* ignore */ }
    }
    if (objs.length) return objs;
  } catch (e) {}
  return null;
}

const PROMPT = `You are an assistant that splits a long Russian or English text into semantically coherent chunks.
Return a JSON array where each element has keys: content, semantic_tag, sentiment.
- content: the extracted text for the chunk (complete sentence(s), preserve meaning).
- semantic_tag: one of: "Ключевая идея", "Доказательство", "Событие", "Деталь", "Вопрос", "Резюме", "Другое".
- sentiment: one of: "Положительный", "Отрицательный", "Нейтральный".

Rules:
- Try to identify complete thoughts or events; do not arbitrarily split sentences.
- Keep chunks reasonably sized (a few sentences, but can be longer if expressing a full idea).
- Preserve original wording as much as possible.
- Output must be valid JSON (a single array). No extra commentary.
- IMPORTANT: Do NOT wrap the JSON in triple backticks. If a chunk's text contains characters that might break JSON (quotes, newlines), you may instead provide content_b64 containing the base64-encoded UTF-8 text; the parser will decode it. If you use content_b64, omit content.

Example output:
[
  {"content": "...", "semantic_tag": "Ключевая идея", "sentiment": "Нейтральный"},
  ...
]

Process the following text:
"""
__INPUT__
"""
`;

async function adaptiveChunkText(text) {
  const blocks = splitToBlocks(text || '');
  const results = [];
  // recursive processing: if a block's response is incomplete, split and retry
  async function processBlock(block) {
    const prompt = PROMPT.replace('__INPUT__', block);
    let resp;
    try {
      resp = await sendPromptToLLM(prompt);
    } catch (e) {
      console.warn('LLM chunking failed for block, falling back to sentence-split:', e && e.message || e);
      const fallback = block.split(/(?<=[.!?])\s+/).slice(0, 50);
      fallback.forEach(s => { if (s && s.trim()) results.push({ content: s.trim(), semantic_tag: 'Другое', sentiment: 'Нейтральный' }); });
      return;
    }

    // normalize to object { text, incomplete }
    let rawText = '';
    let incomplete = false;
    if (resp && typeof resp === 'object' && ('text' in resp || 'incomplete' in resp)) {
      rawText = String(resp.text || '');
      incomplete = !!resp.incomplete;
    } else {
      rawText = String(resp || '');
    }

    if (process.env.DEBUG_CHUNKING === '1') {
      try {
        console.log('---RAW_LLM_RESPONSE_START---');
        console.log(rawText.length > 2000 ? rawText.slice(0,2000) + '\n...[truncated]' : rawText);
        console.log('---RAW_LLM_RESPONSE_END---');
      } catch (e) { console.log('---RAW_PRINT_FAIL---', e && e.message || e); }
    }

    // If response was truncated/incomplete, split block and retry recursively
    if (incomplete) {
      // split into halves and process each
      const half = Math.ceil(block.length / 2);
      const left = block.slice(0, half);
      const right = block.slice(half);
      await processBlock(left);
      await processBlock(right);
      return;
    }

    // Try to parse JSON array from raw text using tolerant helper
    const parsed = parseJsonArrayFromText(rawText);
    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        if (p && (p.content || p.content_b64)) {
          let content = p.content;
          // support optional base64-encoded content field
          if (!content && p.content_b64) {
            try { content = Buffer.from(p.content_b64, 'base64').toString('utf8'); } catch (e) { content = '' }
          }
          if (content && content.trim()) {
            results.push({ content: String(content).trim(), semantic_tag: String(p.semantic_tag || 'Другое'), sentiment: String(p.sentiment || 'Нейтральный') });
          }
        }
      }
      return;
    }

    // If parsing failed, fall back to sentence split
    console.warn('Failed to parse LLM chunking JSON, falling back: could not recover array');
    const fallback = block.split(/(?<=[.!?])\s+/).slice(0, 50);
    fallback.forEach(s => { if (s && s.trim()) results.push({ content: s.trim(), semantic_tag: 'Другое', sentiment: 'Нейтральный' }); });
  }

  for (const block of blocks) {
    await processBlock(block);
  }
  return results;
}

module.exports = { adaptiveChunkText };
