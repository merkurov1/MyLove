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
 * Логирует метрики запроса в структурированном JSON формате
 * Можно потом анализировать или отправлять в monitoring system
 */
export function trackQuery(metrics: QueryMetrics) {
  // Структурированный лог для легкого парсинга
  console.log('[METRICS]', JSON.stringify({
    ...metrics,
    // Добавляем вычисляемые метрики
    quality_score: calculateQualityScore(metrics),
    performance_grade: getPerformanceGrade(metrics.total_latency_ms)
  }));
  
  // Для development - показываем красиво
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📊 Query Metrics:');
    console.log(`   Query: "${metrics.query.substring(0, 50)}${metrics.query.length > 50 ? '...' : ''}"`);
    console.log(`   Intent: ${metrics.intent_action} (${(metrics.intent_confidence * 100).toFixed(0)}%)`);
    console.log(`   Search: ${metrics.search_type} → ${metrics.results_count} results (top: ${(metrics.top_similarity * 100).toFixed(1)}%)`);
    console.log(`   Performance: ${metrics.total_latency_ms}ms (search: ${metrics.search_latency_ms}ms, LLM: ${metrics.llm_latency_ms}ms)`);
    console.log(`   Context: ${metrics.context_length} chars, ${metrics.sources_count} sources`);
    console.log(`   Quality: ${calculateQualityScore(metrics).toFixed(2)}/1.0\n`);
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

/**
 * Агрегированная статистика за сессию
 */
class SessionStats {
  private queries: QueryMetrics[] = [];
  
  add(metrics: QueryMetrics) {
    this.queries.push(metrics);
  }
  
  getStats() {
    if (this.queries.length === 0) return null;
    
    const totalQueries = this.queries.length;
    const avgLatency = this.queries.reduce((sum, q) => sum + q.total_latency_ms, 0) / totalQueries;
    const avgSimilarity = this.queries.reduce((sum, q) => sum + q.top_similarity, 0) / totalQueries;
    const successRate = this.queries.filter(q => q.has_answer).length / totalQueries;
    
    return {
      total_queries: totalQueries,
      avg_latency_ms: Math.round(avgLatency),
      avg_similarity: avgSimilarity.toFixed(3),
      success_rate: (successRate * 100).toFixed(1) + '%',
      quality_scores: this.queries.map(q => calculateQualityScore(q)),
      avg_quality: this.queries.reduce((sum, q) => sum + calculateQualityScore(q), 0) / totalQueries
    };
  }
  
  reset() {
    this.queries = [];
  }
}

export const sessionStats = new SessionStats();

/**
 * Простой rate limiting tracker
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  check(identifier: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Удаляем старые запросы за пределами окна
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    return true;
  }
  
  reset(identifier: string) {
    this.requests.delete(identifier);
  }
}

export const rateLimiter = new RateLimiter();

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
