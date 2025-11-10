// Compatibility shim for test scripts that run with plain Node (CommonJS)
// Minimal implementation: generate embedding using Vercel AI SDK
// This avoids requiring TypeScript transpilation when running simple node tests.

const { embed } = require('ai');
const { openai } = require('@ai-sdk/openai');

async function getEmbedding(text) {
  if (!text || typeof text !== 'string') throw new Error('Invalid text');

  // Use OpenAI text-embedding-3-small
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text
  });

  return embedding;
}

module.exports = {
  getEmbedding,
  EMBEDDING_DIMENSION: 1536
};
