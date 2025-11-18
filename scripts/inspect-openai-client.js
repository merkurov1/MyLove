#!/usr/bin/env node
// scripts/inspect-openai-client.js
// Inspect the runtime shape of the @ai-sdk/openai client instance.
// This script does NOT call any remote APIs — it only introspects the exported objects

const mod = require('@ai-sdk/openai');
const createOpenAI = mod.createOpenAI || mod.createOpenAI || null;
const topOpenai = mod.openai || mod.default || mod;
const client = (typeof createOpenAI === 'function') ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }) : topOpenai;

console.log('OPENAI_API_KEY present?', !!process.env.OPENAI_API_KEY);
console.log('module keys:', Object.keys(mod));
console.log('top-level openai keys:', Object.keys(topOpenai || {}));
console.log('client keys:', Object.keys(client || {}));

const seen = new WeakSet();
const results = [];

function safeGet(obj, key) {
  try {
    return obj[key];
  } catch (e) {
    return undefined;
  }
}

function recurse(obj, path = [], depth = 0, maxDepth = 3) {
  if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > maxDepth) return;
  seen.add(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = safeGet(obj, key);
    const p = path.concat([key]);
    try {
      if (typeof val === 'function') {
        results.push({ path: p.join('.'), type: 'function' });
      } else if (val && typeof val === 'object') {
        results.push({ path: p.join('.'), type: 'object' });
        recurse(val, p, depth + 1, maxDepth);
      } else {
        results.push({ path: p.join('.'), type: typeof val });
      }
    } catch (e) {
      results.push({ path: p.join('.'), type: 'uninspectable' });
    }
  }
}

recurse(client, [], 0, 3);

// Print first 500 lines
for (const r of results.slice(0, 500)) {
  console.log(r.path.padEnd(80), r.type);
}

console.log('\nTotal entries found:', results.length);
console.log('If you want, run this and paste the output. I will use the function paths to pick the correct API method names.');
