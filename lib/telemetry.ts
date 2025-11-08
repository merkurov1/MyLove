// lib/telemetry.ts - Simple monitoring and metrics

export interface QueryMetrics {
  timestamp: string;
  query: string;
  query_length: number;
  intent_action: string;
  intent_confidence: number;
  
  // Search metrics
  search_type: 'vector' | 'hybrid' | 'fallback';
  results_count: number;
  top_similarity: number;
  reranking_applied: boolean;
  
  // Performance
  search_latency_ms: number;
  llm_latency_ms: number;
  total_latency_ms: number;
  
  // Context
  context_length: number;
  sources_count: number;
  
  // LLM
  model_used: string;
  tokens_estimated: number;
  
  // Result
  has_answer: boolean;
  error?: string;
}

/**
 * Логирует метрики запроса (упрощенная версия для single-user)
 */
export function trackQuery(metrics: QueryMetrics) {
  const quality = calculateQualityScore(metrics);
  const grade = getPerformanceGrade(metrics.total_latency_ms);
  
  // Компактный лог только важных метрик
  console.log(`[METRICS] ${grade} | ${metrics.intent_action} | sim:${metrics.top_similarity.toFixed(2)} | ${metrics.total_latency_ms}ms | ${metrics.results_count} results | quality:${quality.toFixed(2)}`);
  
  // JSON только если есть проблемы
  if (quality < 0.5 || metrics.total_latency_ms > 5000) {
    console.warn('[METRICS:LOW_QUALITY]', JSON.stringify(metrics, null, 2));
  }
}

/**
 * Вычисляет общий quality score на основе метрик
 * 0 = плохо, 1 = отлично
 */
function calculateQualityScore(metrics: QueryMetrics): number {
  let score = 0;
  
  // Similarity score (40%)
  score += metrics.top_similarity * 0.4;
  
  // Intent confidence (20%)
  score += metrics.intent_confidence * 0.2;
  
  // Results availability (20%)
  score += (metrics.results_count > 0 ? 1 : 0) * 0.2;
  
  // Performance bonus (10%)
  const perfBonus = metrics.total_latency_ms < 3000 ? 0.1 : 
                    metrics.total_latency_ms < 5000 ? 0.05 : 0;
  score += perfBonus;
  
  // Context quality (10%)
  const contextBonus = metrics.context_length > 1000 && metrics.context_length < 10000 ? 0.1 : 0.05;
  score += contextBonus;
  
  return Math.min(1, score);
}

/**
 * Оценка производительности
 */
function getPerformanceGrade(latencyMs: number): string {
  if (latencyMs < 1000) return 'A+'; // Отлично
  if (latencyMs < 2000) return 'A';  // Хорошо
  if (latencyMs < 3000) return 'B';  // Нормально
  if (latencyMs < 5000) return 'C';  // Приемлемо
  return 'D'; // Медленно
}

// SessionStats и RateLimiter удалены - не нужны для single-user персонального ассистента

/**
 * Alert на аномалии
 */
export function checkAnomalies(metrics: QueryMetrics) {
  const alerts = [];
  
  // Очень низкая similarity
  if (metrics.top_similarity < 0.2) {
    alerts.push(`⚠️ Very low similarity: ${(metrics.top_similarity * 100).toFixed(1)}%`);
  }
  
  // Медленный ответ
  if (metrics.total_latency_ms > 10000) {
    alerts.push(`⚠️ Slow response: ${metrics.total_latency_ms}ms`);
  }
  
  // Нет результатов
  if (metrics.results_count === 0) {
    alerts.push(`⚠️ No results found for query: "${metrics.query}"`);
  }
  
  // Очень длинный контекст
  if (metrics.context_length > 15000) {
    alerts.push(`⚠️ Large context: ${metrics.context_length} chars`);
  }
  
  if (alerts.length > 0) {
    console.log('\n🚨 ANOMALIES DETECTED:');
    alerts.forEach(alert => console.log(`   ${alert}`));
    console.log('');
  }
  
  return alerts;
}
