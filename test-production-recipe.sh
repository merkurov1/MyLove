#!/bin/bash

# Production testing script for recipe search improvements
# Tests the deployed application at production URL

PROD_URL="https://mylove-dashboard.vercel.app"  # Replace with your actual production URL

echo "🚀 Testing production recipe search improvements..."
echo "Production URL: $PROD_URL"
echo ""

# Function to test API
test_api() {
    local query="$1"
    local description="$2"

    echo "🧪 Testing: $description"
    echo "Query: '$query'"

    start_time=$(date +%s.%3N)

    response=$(curl -X POST "$PROD_URL/api/chat" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"$query\"}" \
        --connect-timeout 10 \
        --max-time 60 \
        -s)

    end_time=$(date +%s.%3N)
    duration=$(echo "$end_time - $start_time" | bc)

    # Check if response is valid JSON
    if echo "$response" | jq -e . >/dev/null 2>&1; then
        reply_length=$(echo "$response" | jq -r '.reply | length')
        sources_count=$(echo "$response" | jq -r '.sources | length')

        echo "✅ Response received in ${duration}s"
        echo "📝 Reply length: $reply_length chars"
        echo "🔍 Sources found: $sources_count"

        # Check for recipe content
        has_recipes=$(echo "$response" | jq -r '.reply' | grep -i -c "рецепт\|блюдо\|ингредиент\|готовить" || echo "0")
        echo "🍳 Recipe mentions: $has_recipes"

        # Show first 200 chars of reply
        echo "📄 Response preview:"
        echo "$response" | jq -r '.reply' | head -c 200
        echo "..."
        echo ""

    else
        echo "❌ Invalid JSON response:"
        echo "$response" | head -10
        echo ""
    fi
}

# Test 1: Recipe search
test_api "найди все рецепты еды" "Recipe search - find all recipes"

# Test 2: Same query again (should be more consistent now)
echo "🔄 Testing same query again for consistency..."
test_api "найди все рецепты еды" "Recipe search - same query again"

# Test 3: Specific recipe query
test_api "рецепт пасты с тунцом" "Specific recipe - pasta with tuna"

# Test 4: Cooking query
test_api "как приготовить чахохбили" "Specific dish - chakhokhbili"

# Test 5: Short query (should use optimized search)
test_api "еда" "Short query - food"

# Test 6: Embedding cache test (same technical query)
echo "⚡ Testing embedding cache with technical query..."
test_api "что такое rag система" "Technical query for cache test"
test_api "что такое rag система" "Same technical query (should be cached)"

echo "🎉 Production testing completed!"
echo ""
echo "📊 Analysis:"
echo "- Check if recipe searches return multiple recipes with ingredients"
echo "- Verify responses are consistent between same queries"
echo "- Confirm cache is working (second technical query should be faster)"
echo "- Ensure proper formatting of recipe information"