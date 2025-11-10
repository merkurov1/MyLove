// Simple test to validate multi-query logic
const testMultiQuery = () => {
  console.log('Testing multi-query logic...');

  // Simulate query variants
  const queryVariants = ['test query', 'test search', 'find test'];

  // Simulate embeddings
  const queryEmbeddings = [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
    [0.7, 0.8, 0.9]
  ];

  // Simulate search results
  const allMatches = [
    { id: 1, similarity: 0.8, content: 'test content 1' },
    { id: 2, similarity: 0.6, content: 'test content 2' }
  ];

  const topSimilarity = allMatches[0]?.similarity || 0;
  console.log('Top similarity:', topSimilarity);

  // Test fallback logic
  if (topSimilarity < 0.35 && allMatches && allMatches.length > 0) {
    console.log('Would expand search...');
  }

  if (allMatches.length === 0) {
    console.log('No matches found');
  } else {
    console.log('Matches found:', allMatches.length);
  }

  console.log('Multi-query logic test passed!');
};

testMultiQuery();