#!/usr/bin/env node
/**
 * Test script for Pierrot Art Advisor persona
 * Tests multilingual responses, tonality, and art collection knowledge
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

const testCases = [
  {
    name: 'English: Ask about specific artist (Basquiat)',
    query: 'Tell me about Basquiat',
    expectedLanguage: 'en',
    shouldContain: ['Basquiat', 'explosive', 'loud', 'energy']
  },
  {
    name: 'Russian: Ask about specific artist (Buffet)',
    query: 'Расскажи о Буффе',
    expectedLanguage: 'ru',
    shouldContain: ['Буффе', 'зим', 'тиш', 'молча']
  },
  {
    name: 'English: What do you have?',
    query: 'What do you have?',
    expectedLanguage: 'en',
    shouldContain: ['noise', 'silence', 'prefer']
  },
  {
    name: 'Russian: What do you have?',
    query: 'Что у вас есть?',
    expectedLanguage: 'ru',
    shouldContain: ['шум', 'тиш']
  },
  {
    name: 'English: Budget question',
    query: 'I have a budget of $50k. What can I get?',
    expectedLanguage: 'en',
    shouldContain: ['budget', 'price']
  },
  {
    name: 'Russian: Looking for something quiet',
    query: 'Покажи что-то тихое и спокойное',
    expectedLanguage: 'ru',
    shouldContain: ['тих', 'спокой', 'молча']
  },
  {
    name: 'English: Looking for something dark',
    query: 'I want something dark and melancholic',
    expectedLanguage: 'en',
    shouldContain: ['dark', 'melanchol']
  },
  {
    name: 'Russian: Advisor recommendation',
    query: 'Посоветуй что-то необычное',
    expectedLanguage: 'ru',
    shouldContain: ['необыч', 'секрет', 'редк']
  },
  {
    name: 'English: Trophy vs Secret',
    query: 'Should I get a trophy piece or something secret?',
    expectedLanguage: 'en',
    shouldContain: ['trophy', 'secret']
  },
  {
    name: 'Mixed: URL-based query (merkurov.love)',
    query: 'What is this artwork? https://www.merkurov.love/zhang-xiaogang-b-1958-dull-red',
    expectedLanguage: 'en',
    shouldContain: ['Zhang', 'Xiaogang', 'Dull Red']
  }
];

async function runTest(testCase) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${testCase.name}`);
  console.log(`QUERY: ${testCase.query}`);
  console.log(`${'='.repeat(80)}`);

  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: testCase.query,
        settings: {}
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('\n[RESPONSE]');
    console.log(data.reply);

    // Validate response
    const reply = data.reply.toLowerCase();
    const passedChecks = [];
    const failedChecks = [];

    // Check language
    const cyrillic = (data.reply.match(/[\u0400-\u04FF]/g) || []).length;
    const latin = (data.reply.match(/[a-zA-Z]/g) || []).length;
    const detectedLang = cyrillic > latin ? 'ru' : 'en';
    
    if (detectedLang === testCase.expectedLanguage) {
      passedChecks.push(`✓ Language: ${detectedLang}`);
    } else {
      failedChecks.push(`✗ Language mismatch: expected ${testCase.expectedLanguage}, got ${detectedLang}`);
    }

    // Check expected content
    for (const keyword of testCase.shouldContain) {
      if (reply.includes(keyword.toLowerCase())) {
        passedChecks.push(`✓ Contains: "${keyword}"`);
      } else {
        failedChecks.push(`✗ Missing: "${keyword}"`);
      }
    }

    // Check Pierrot tonality indicators
    const pierrotIndicators = [
      'silence', 'тишина', 'noise', 'шум',
      'trophy', 'трофей', 'secret', 'секрет',
      'melanchol', 'меланхол', 'heavy', 'тяж'
    ];
    const hasPierrotTone = pierrotIndicators.some(i => reply.includes(i.toLowerCase()));
    if (hasPierrotTone) {
      passedChecks.push('✓ Pierrot tonality detected');
    }

    console.log('\n[VALIDATION]');
    passedChecks.forEach(c => console.log(c));
    if (failedChecks.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      failedChecks.forEach(c => console.log(c));
    }

    // Check sources
    if (data.sources && data.sources.length > 0) {
      console.log('\n[SOURCES]');
      data.sources.slice(0, 3).forEach((s, i) => {
        console.log(`${i + 1}. ${s.title || 'Untitled'} (similarity: ${s.similarity?.toFixed(3)})`);
        if (s.url) console.log(`   ${s.url}`);
      });
    }

    return {
      name: testCase.name,
      passed: failedChecks.length === 0,
      passedChecks: passedChecks.length,
      failedChecks: failedChecks.length
    };

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    return {
      name: testCase.name,
      passed: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║          PIERROT ART ADVISOR - COMPREHENSIVE TEST SUITE              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log(`\nAPI URL: ${API_URL}`);
  console.log(`Running ${testCases.length} test cases...\n`);

  const results = [];

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\nTotal tests: ${results.length}`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  process.exit(failed > 0 ? 1 : 0);
}

main();
