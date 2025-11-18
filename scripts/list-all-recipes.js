#!/usr/bin/env node
// scripts/list-all-recipes.js
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/list-all-recipes.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

function extractIngredients(text) {
  if (!text) return null;
  // look for common headers
  const ingredientsMatch = text.match(/(ингредиент[ы]?[:\-]?\s*)([\s\S]{0,800}?)(?:\n\s*\n|$)/i);
  if (ingredientsMatch && ingredientsMatch[2]) {
    return ingredientsMatch[2].trim().replace(/\n\s*/g, '; ').slice(0, 500);
  }
  // fallback: look for lines that look like lists (commas or bullets)
  const listMatch = text.match(/(?:^|\n)([-*•]\s*[^\n]{5,200}|[^\n]{5,200},[^\n]{5,200})/i);
  if (listMatch) return listMatch[0].trim().slice(0, 500);
  return null;
}

function extractTime(text) {
  if (!text) return null;
  const m = text.match(/время[:\-]?\s*([^\n\.]{1,80})/i);
  if (m) return m[1].trim();
  const m2 = text.match(/(\d+\s*(минут|ч|час|мин))/i);
  if (m2) return m2[0];
  return null;
}

function extractType(text) {
  if (!text) return null;
  const types = ['закуска','основно','десерт','салат','гарнир','суп','напиток','выпечк','завтрак','обед','ужин'];
  const low = text.toLowerCase();
  for (const t of types) {
    if (low.includes(t)) return t;
  }
  return null;
}

(async function main() {
  try {
    console.log('Searching for documents that look like recipes...');

    // Find document_ids via chunks that mention recipe-related keywords
    const keywordFilter = "%рецепт%";

    const { data: matchChunks, error: chunkErr } = await supabase
      .from('document_chunks')
      .select('document_id')
      .or(`content.ilike.${keywordFilter},content.ilike.%ингредиент%,content.ilike.%ингредиенты%,content.ilike.%готовить%`)
      .limit(10000);

    if (chunkErr) {
      console.error('Error querying chunks:', chunkErr);
      process.exit(1);
    }

    const docIds = Array.from(new Set((matchChunks || []).map(r => r.document_id))).filter(Boolean);

    if (docIds.length === 0) {
      console.log('No recipe-like documents found by chunk search. Trying title/description scan...');
      const { data: docsByMeta } = await supabase
        .from('documents')
        .select('id')
        .or(`title.ilike.%рецепт%,description.ilike.%рецепт%`)
        .limit(10000);
      const ids2 = (docsByMeta || []).map(r => r.id);
      ids2.forEach(id => docIds.push(id));
    }

    if (docIds.length === 0) {
      console.log('No candidate recipe documents found.');
      return;
    }

    // Fetch document metadata + chunks
    const { data: docs, error: docsErr } = await supabase
      .from('documents')
      .select('id, title, description, source_url, created_at, document_chunks(content)')
      .in('id', docIds)
      .order('created_at', { ascending: false });

    if (docsErr) {
      console.error('Error fetching documents:', docsErr);
      process.exit(1);
    }

    // Score and filter documents to show likely recipes only
    console.log('\n📚 НАЙДЕННЫЕ КАНДИДАТЫ (отфильтрованные):\n');

    const recipeKeywords = [/рецепт/i, /ингредиент/i, /приготовлен/i, /готовить/i, /шаг/i, /порц/i, /стакан/i];
    const measureRegex = /(г|гр\.|кг|мл|л|ч\.л\.|ч\.л|ст\.л\.|столов|чайн|tablespoon|tbsp|tsp|cup|gram)/i;
    const listLineRegex = /(^|\n)\s*([-*•\d]+)\s*[A-Za-zА-Яа-яЁё0-9\s,.-]{3,200}/;

    const scored = (docs || []).map(d => {
      const chunks = (d.document_chunks || []).map(c => c.content || '').join('\n\n');
      const text = [d.title || '', d.description || '', chunks].join('\n\n');

      let score = 0;
      for (const k of recipeKeywords) {
        const m = (text.match(k) || []).length;
        score += Math.min(m, 3);
      }
      if (measureRegex.test(text)) score += 2;
      if (listLineRegex.test(text)) score += 1;

      const ingredients = extractIngredients(text) || '';
      if (ingredients && ingredients.length > 10) score += 1;

      return { doc: d, score, text, ingredients };
    });

    // Pick those above threshold
    const threshold = 3; // tweakable
    const filtered = scored
      .filter(s => s.score >= threshold)
      // dedupe by source_url or title
      .reduce((acc, s) => {
        const key = (s.doc.source_url || s.doc.title || '').trim();
        if (!acc.byKey.has(key)) {
          acc.byKey.set(key, true);
          acc.list.push(s);
        }
        return acc;
      }, { byKey: new Map(), list: [] })
      .list
      .sort((a, b) => b.score - a.score || ((b.doc.created_at || '') > (a.doc.created_at || '') ? 1 : -1));

    if (filtered.length === 0) {
      console.log('Ни одного явного рецепта не найдено по текущим эвристикам. Попробуйте увеличить лимит или добавить ключевые слова.');
    }

    const output = [];
    for (const s of filtered) {
      const d = s.doc;
      const desc = d.description || s.text.substring(0, 300) || 'Нет описания';
      const time = extractTime(s.text) || 'Не указано';
      const type = extractType(s.text) || 'Не указано';
      const ingredients = s.ingredients || 'Не указано';

      console.log(`🍽️ ${d.title || d.source_url || 'Без названия'} • Тип: ${type} • Время: ${time} • Ингредиенты: ${ingredients.slice(0,200)} • Описание: ${desc.slice(0,200)}`);
      console.log('');

      output.push({ id: d.id, title: d.title, source_url: d.source_url, created_at: d.created_at, type, time, ingredients, description: desc });
    }

    console.log(`Всего найдено (после фильтра): ${filtered.length}`);

    // Optional: write JSON to disk
    const fs = require('fs');
    try {
      fs.writeFileSync('recipes-found.json', JSON.stringify(output, null, 2));
      console.log('Результаты записаны в recipes-found.json');
    } catch (e) {
      // ignore
    }

  } catch (err) {
    console.error('Unexpected error', err);
    process.exit(1);
  }
})();
