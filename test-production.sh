#!/bin/bash

echo "🧪 Testing production improvements..."
echo ""

# Test 1: Recipe search
echo "1️⃣ Testing recipe search: 'найди все рецепты еды'"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"найди все рецепты еды"}' \
  --connect-timeout 5 \
  --max-time 30 \
  -s | jq -r '.reply' | head -20

echo ""
echo "✅ Recipe search test completed"
echo ""

# Test 2: Embedding cache (run same query twice)
echo "2️⃣ Testing embedding caching..."

# First request
echo "First request (generates embedding):"
time curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"тестовый запрос для кэширования"}' \
  -s -o /dev/null -w "HTTP %{http_code}, Time: %{time_total}s\n"

# Second request (should be cached)
echo "Second request (should be cached):"
time curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"тестовый запрос для кэширования"}' \
  -s -o /dev/null -w "HTTP %{http_code}, Time: %{time_total}s\n"

echo ""
echo "✅ Cache test completed"
echo ""

# Test 3: Short query optimization
echo "3️⃣ Testing short query optimization: 'еда'"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"еда"}' \
  --connect-timeout 5 \
  --max-time 15 \
  -s | jq -r '.reply' | head -10

echo ""
echo "✅ Short query test completed"
echo ""

echo "🎉 All tests completed!"
echo ""
echo "📈 Check results:"
echo "- Recipe search should return multiple recipes with ingredients"
echo "- Second cache request should be faster"
echo "- Short query should work without multi-query overhead"