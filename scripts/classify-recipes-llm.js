#!/usr/bin/env node
// scripts/classify-recipes-llm.js
// Usage: set OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY then run

const { createClient } = require('@supabase/supabase-js');
const { openai } = require('@ai-sdk/openai');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('Please set OPENAI_API_KEY in the environment for classification.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function fetchCandidateDocIds(limit = 2000) {
  // Find document ids where chunks contain recipe keywords OR title/description mention "рецепт"
  const { data: chunks } = await supabase
    .from('document_chunks')
    .select('document_id')
    .or(`content.ilike.%рецепт%,content.ilike.%ингредиент%,content.ilike.%готовить%`)
    .limit(limit);

  const ids = Array.from(new Set((chunks || []).map(r => r.document_id))).filter(Boolean);
  console.log(`Found ${ids.length} candidate document ids from chunks`);
  return ids;
}

async function fetchDocsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const { data: docs } = await supabase
    .from('documents')
    .select('id, title, description, source_url, created_at, document_chunks(content)')
    .in('id', ids)
    .order('created_at', { ascending: false });
  return docs || [];
}

function buildPromptForDoc(d) {
  const chunks = (d.document_chunks || []).map(c => c.content || '').join('\n\n');
  const text = `Title: ${d.title || ''}\nDescription: ${d.description || ''}\nContent:\n${chunks.slice(0, 6000)}`;

  const prompt = `You are a classifier. Analyze the following document and answer in JSON only with keys: is_recipe (true/false), confidence (0-1), ingredients (array of short strings), time (short string or null), type (one of: закуска, основное, десерт, салат, суп, гарнир, напиток, выпечка, другое). Document:\n${text}\n\nReturn only valid JSON.`;
  return prompt;
}

async function classifyDocWithLLM(doc) {
  const prompt = buildPromptForDoc(doc);

  try {
    // Flexible caller: support multiple shapes of the Vercel AI / @ai-sdk/openai
    // Some versions expose: openai.chat.completions.create(...)
    // Others expose: openai.chat.create(...) or openai.responses.create(...)
    async function sendPrompt(p) {
      const messages = [{ role: 'user', content: p }];

      if (openai && openai.chat && openai.chat.completions && typeof openai.chat.completions.create === 'function') {
        const resp = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages, max_tokens: 400, temperature: 0 });
        return resp.choices?.[0]?.message?.content || resp.choices?.[0]?.text || '';
      }

      if (openai && openai.chat && typeof openai.chat.create === 'function') {
        const resp = await openai.chat.create({ model: 'gpt-4o-mini', messages, max_tokens: 400, temperature: 0 });
        return resp.choices?.[0]?.message?.content || resp.output_text || '';
      }

      if (openai && typeof openai.responses === 'object' && typeof openai.responses.create === 'function') {
        const resp = await openai.responses.create({ model: 'gpt-4o-mini', input: p, max_output_tokens: 400, temperature: 0 });
        if (resp.output_text) return resp.output_text;
        if (Array.isArray(resp.output)) {
          // Try to extract textual parts
          const texts = resp.output.map(o => {
            if (o.type === 'message' && Array.isArray(o.content)) {
              return o.content.map(c => c.text || '').join('');
            }
            return o.text || '';
          }).filter(Boolean);
          if (texts.length) return texts.join('\n');
        }
        return JSON.stringify(resp);
      }

      throw new Error('No compatible OpenAI client method found on `openai`.');
    }

    const raw = await sendPrompt(prompt);
    let parsed = null;
    try {
      // Try to extract JSON from the reply
      const jsonStart = raw.indexOf('{');
      const jsonText = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.warn('Failed to parse JSON from LLM response:', raw.substring(0, 200));
      return null;
    }

    return parsed;
  } catch (err) {
    console.error('LLM call failed', err?.message || err);
    return null;
  }
}

async function updateDocumentFlag(docId, isRecipe) {
  try {
    const { error } = await supabase.from('documents').update({ is_recipe: isRecipe }).eq('id', docId);
    if (error) {
      console.warn('Failed to update doc', docId, error.message);
    }
  } catch (e) {
    console.warn('Update failed', e.message || e);
  }
}

(async function main() {
  try {
    const ids = await fetchCandidateDocIds(5000);
    const docs = await fetchDocsByIds(ids);
    console.log(`Loaded ${docs.length} documents for classification`);

    const results = [];
    for (const d of docs) {
      console.log('\nClassifying:', d.id, d.title || d.source_url || 'no-title');
      const r = await classifyDocWithLLM(d);
      if (!r) continue;
      const is_recipe = Boolean(r.is_recipe === true || r.is_recipe === 'true');
      const confidence = Number(r.confidence || 0);
      console.log(' -> is_recipe:', is_recipe, 'confidence:', confidence);
      if (is_recipe && confidence >= 0.6) {
        console.log(' -> Marking document as recipe in DB');
        await updateDocumentFlag(d.id, true);
      }
      results.push({ id: d.id, is_recipe, confidence, parsed: r });

      // Respectful pause to avoid rate limits
      await new Promise(res => setTimeout(res, 500));
    }

    // Write results
    const fs = require('fs');
    fs.writeFileSync('recipe-classify-results.json', JSON.stringify(results, null, 2));
    console.log('Classification finished. Results: recipe-classify-results.json');
  } catch (err) {
    console.error('Fatal error', err?.message || err);
    process.exit(1);
  }
})();
