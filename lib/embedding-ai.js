// Compatibility shim for test scripts that run with plain Node (CommonJS)
// Minimal implementation: generate embedding using Vercel AI SDK
// This avoids requiring TypeScript transpilation when running simple node tests.


const { createOpenAI, openai } = require('@ai-sdk/openai');
const { embed } = require('ai');

// Safe fetch: use global.fetch if present, otherwise try node-fetch (if installed)
const _fetch = (typeof global !== 'undefined' && global.fetch) ? global.fetch : (function () {
  try {
    return require('node-fetch');
  } catch (e) {
    return null;
  }
})();

// Try to create a client instance; fall back to top-level export
const client = (typeof createOpenAI === 'function') ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }) : (openai || {});

async function getEmbedding(text) {
  if (!text || typeof text !== 'string') throw new Error('Invalid text');

  // Candidate methods to call for embedding on the client
  const candidates = [
    async () => (client.textEmbedding && client.textEmbedding.create) ? await client.textEmbedding.create({ model: 'text-embedding-3-small', input: text }) : null,
    async () => (client.embedding && client.embedding.create) ? await client.embedding.create({ model: 'text-embedding-3-small', input: text }) : null,
    async () => (client.embeddings && client.embeddings.create) ? await client.embeddings.create({ model: 'text-embedding-3-small', input: text }) : null,
  ];

  for (const c of candidates) {
    try {
      const res = await c();
      if (!res) continue;
      // Common shapes: { data: [{ embedding: [...] }] } or { embedding: [...] }
      if (res.data && Array.isArray(res.data) && res.data[0] && Array.isArray(res.data[0].embedding)) {
        return res.data[0].embedding;
      }
      if (Array.isArray(res) && res[0] && Array.isArray(res[0].embedding)) return res[0].embedding;
      if (res.embedding && Array.isArray(res.embedding)) return res.embedding;
      // Some vendor SDKs return wrapper with spec info — try to find nested fields
      if (res?.result?.[0]?.embedding && Array.isArray(res.result[0].embedding)) return res.result[0].embedding;
      // If we got a config-like object (no vectors), skip
      console.warn('Embedding call returned unexpected shape, keys:', Object.keys(res || {}));
    } catch (e) {
      console.warn('Embedding candidate failed:', e && e.message || e);
    }
  }

  // Fallback: try using the `ai` package with a model descriptor from the SDK
  try {
    const modelDescriptor = (openai && typeof openai.embedding === 'function') ? openai.embedding('text-embedding-3-small') : null;
    if (modelDescriptor) {
      const { embedding } = await embed({ model: modelDescriptor, value: text });
      if (Array.isArray(embedding)) return embedding;
    }
  } catch (e) {
    console.warn('Fallback embed via ai.embed failed:', e && e.message || e);
  }
  // Final fallback: call OpenAI embeddings REST API directly
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set for HTTP fallback');
    if (!_fetch) throw new Error('No fetch available in this Node runtime. Install node-fetch or use Node 18+');
    const resp = await _fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
    });
    const json = await resp.json();
    const vec = json?.data?.[0]?.embedding;
    if (Array.isArray(vec)) return vec;
    console.warn('HTTP embedding fallback returned unexpected shape', Object.keys(json || {}));
  } catch (e) {
    console.warn('HTTP embedding fallback failed:', e && e.message || e);
  }

  throw new Error('No embedding method succeeded on OpenAI client');
}

module.exports = {
  getEmbedding,
  EMBEDDING_DIMENSION: 1536
};
