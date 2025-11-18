#!/usr/bin/env node
// scripts/test-openai-client.js
// Simple diagnostic for @ai-sdk/openai and OPENAI_API_KEY
// Usage:
//   node scripts/test-openai-client.js            # prints shapes and env presence
//   node scripts/test-openai-client.js --api-test  # runs a minimal API call (will incur usage)

const args = process.argv.slice(2);
const doApiTest = args.includes('--api-test') || args.includes('--test');

function safeRequire(name) {
  try {
    return require(name);
  } catch (e) {
    console.error(`Could not require ${name}:`, e && e.message ? e.message : e);
    process.exitCode = 2;
    return null;
  }
}

const mod = safeRequire('@ai-sdk/openai');
if (!mod) process.exit(2);

const topOpenai = mod.openai || mod.default || mod;
const createOpenAI = mod.createOpenAI || mod.createOpenAI || null;

// create client instance if possible
const client = (typeof createOpenAI === 'function') ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }) : topOpenai;

console.log('OPENAI_API_KEY present?', !!process.env.OPENAI_API_KEY);
console.log('module keys:', Object.keys(mod));
console.log('top-level openai keys:', topOpenai && Object.keys(topOpenai));
console.log('client keys:', client && Object.keys(client));
console.log('has responses.create?', !!(client && client.responses && client.responses.create));
console.log('has chat.completions.create?', !!(client && client.chat && client.chat.completions && client.chat.completions.create));
console.log('has embedding helper (heuristic)?', !!(client && (client.embedding || client.embeddings || client.textEmbedding || client.textEmbeddingModel)));

// Print nested keys for more detailed inspection
function keys(obj) {
  try {
    return obj ? Object.keys(obj) : [];
  } catch (e) {
    return ['<uninspectable>'];
  }
}

console.log('responses keys:', keys(client && client.responses));
console.log('chat keys:', keys(client && client.chat));
console.log('completion keys:', keys(client && client.completion));
console.log('embedding keys:', keys(client && client.embedding));
console.log('textEmbedding keys:', keys(client && client.textEmbedding));
const doEmbedTest = args.includes('--embed-test') || args.includes('--embed');

if (!doApiTest && !doEmbedTest) process.exit(0);
(async () => {
  try {
    if (doApiTest) {
      if (client && client.responses && client.responses.create) {
        console.log('Attempting client.responses.create test...');
        const r = await client.responses.create({ model: 'gpt-4o-mini', input: 'Say hello in one word' });
        console.log('client.responses.create OK:', typeof r !== 'undefined');
      } else if (client && client.chat && client.chat.completions && client.chat.completions.create) {
        console.log('Attempting client.chat.completions.create test...');
        const r = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say hello in one word' }] });
        console.log('client.chat.completions.create OK:', typeof r !== 'undefined');
      } else if (client && client.chat && client.chat.create) {
        console.log('Attempting client.chat.create test...');
        const r = await client.chat.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say hello in one word' }] });
        console.log('client.chat.create OK:', typeof r !== 'undefined');
      } else {
        console.warn('No recognizable client shape found in @ai-sdk/openai for an API test — attempting HTTP fallback to /v1/responses');
        // HTTP fallback: check Responses endpoint to validate API key
        try {
          const key = process.env.OPENAI_API_KEY;
          if (!key) throw new Error('OPENAI_API_KEY not set');
          const fetch = global.fetch || require('node-fetch');
          const res = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', input: 'ping' })
          });
          console.log('HTTP /v1/responses status:', res.status);
          if (res.status === 200) {
            console.log('HTTP Responses API reachable and key accepted');
          } else {
            const body = await res.text().catch(() => '<no-body>');
            console.error('HTTP Responses API returned non-200:', res.status, body.slice(0, 1000));
            process.exitCode = 3;
          }
        } catch (e) {
          console.error('HTTP fallback for Responses API failed:', e && e.message ? e.message : e);
          process.exitCode = 3;
        }
      }
    }

    if (doEmbedTest) {
      // Try a set of common embedding method names until one works
      const embedCandidates = [
        ['embedding', 'create'],
        ['embedding', 'embed'],
        ['textEmbedding', 'create'],
        ['textEmbedding', 'embed'],
        ['embeddings', 'create'],
        ['embedding', 'createEmbedding'],
        ['createEmbedding'],
        ['embedding'],
      ];

      let did = false;
      for (const candidate of embedCandidates) {
        try {
          let fn = client;
          if (candidate.length === 1) fn = fn[candidate[0]];
          else fn = (fn[candidate[0]] || {})[candidate[1]] || fn[candidate[0]] && fn[candidate[0]][candidate[1]];
          if (typeof fn === 'function') {
            console.log('Trying embedding candidate on client:', candidate);
            const res = await fn.call(client, { model: 'text-embedding-3-small', input: 'hello' });
            console.log('Embedding call succeeded for', candidate, '->', Object.keys(res || {}));
            did = true;
            break;
          }
        } catch (e) {
          console.log('Candidate', candidate, 'failed:', e && e.message ? e.message : e);
        }
      }
      if (!did) {
        console.warn('No embedding method succeeded from client candidates — attempting HTTP /v1/embeddings fallback');
        try {
          const key = process.env.OPENAI_API_KEY;
          if (!key) throw new Error('OPENAI_API_KEY not set');
          const fetch = global.fetch || require('node-fetch');
          const r = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ model: 'text-embedding-3-small', input: 'hello' })
          });
          console.log('HTTP /v1/embeddings status:', r.status);
          const j = await r.json().catch(() => null);
          if (r.status === 200) console.log('HTTP embeddings OK, keys:', j && Object.keys(j || {}));
          else console.error('HTTP embeddings returned non-200:', r.status, j && JSON.stringify(j).slice(0, 1000));
        } catch (e) {
          console.error('HTTP embeddings fallback failed:', e && e.message ? e.message : e);
        }
      }
    }
  } catch (e) {
    console.error('API test error:', e && e.message ? e.message : e);
    process.exitCode = 4;
  }
})();
