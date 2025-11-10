// Utilities for search processing: normalization helpers

export function normalizeTitle(title: string): string {
  if (!title) return '';
  // Lowercase, remove punctuation, collapse spaces, remove common stopwords
  const stopwords = ['рецепт', 'блюдо', 'из', 'с', 'и', 'на', 'для', 'по'];
  let t = title.trim().toLowerCase();
  // remove emojis and non-letter/digit characters except spaces
  // Use a broader regex compatible with older TS targets to remove most non-word characters
  // Strip common emoji ranges using surrogate pairs (compatible with older JS targets)
  t = t.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g, '');
  t = t.replace(/[^\w\s\dа-яёА-ЯЁ\-]/g, '');
  t = t.replace(/\s+/g, ' ');
  // remove stopwords
  const words = t.split(' ').filter(w => w && !stopwords.includes(w));
  return words.join(' ').trim();
}

export default { normalizeTitle };
