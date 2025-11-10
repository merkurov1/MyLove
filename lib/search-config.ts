// Centralized search and reranking configuration
import { EMBEDDING_DIMENSION as _EMBEDDING_DIMENSION } from './embedding-ai';

export const EMBEDDING_DIMENSION = _EMBEDDING_DIMENSION;

export const DEFAULT_MATCH_COUNT = 7;
export const ALL_RECIPES_MATCH_COUNT = 100;
export const COOKING_MATCH_COUNT = 20;

export const MIN_SIMILARITY_DEFAULT = 0.3;
export const MIN_SIMILARITY_RECIPES = 0.2;
export const MIN_SIMILARITY_JOURNALISM = 0.35;

export const RELAXED_MIN_DELTA = 0.15;
export const RELAXED_MIN_FLOOR = 0.05;

export const KEYWORD_WEIGHT_DEFAULT = 0.3;
export const SEMANTIC_WEIGHT_DEFAULT = 0.7;

export const HYBRID_WEIGHTS = {
  allList: { keyword: 0.7, semantic: 0.3 },
  cooking: { keyword: 0.5, semantic: 0.5 },
  short: { keyword: 0.6, semantic: 0.4 },
  analytical: { keyword: 0.2, semantic: 0.8 },
  sourceMention: { keyword: 0.5, semantic: 0.5 }
};

export const RERANK_SIMILARITY_THRESHOLD = 0.5;
export const RERANK_EMBEDDING_WEIGHT = 0.4; // weight for embedding similarity when mixing
export const RERANK_LLM_WEIGHT = 0.6; // weight for LLM rerank score when mixing

export const RECIPE_CONTEXT_LIMIT = 16000;

export default {
  EMBEDDING_DIMENSION,
  DEFAULT_MATCH_COUNT,
  ALL_RECIPES_MATCH_COUNT,
  COOKING_MATCH_COUNT,
  MIN_SIMILARITY_DEFAULT,
  MIN_SIMILARITY_RECIPES,
  MIN_SIMILARITY_JOURNALISM,
  RELAXED_MIN_DELTA,
  RELAXED_MIN_FLOOR,
  KEYWORD_WEIGHT_DEFAULT,
  SEMANTIC_WEIGHT_DEFAULT,
  HYBRID_WEIGHTS,
  RERANK_SIMILARITY_THRESHOLD,
  RERANK_EMBEDDING_WEIGHT,
  RERANK_LLM_WEIGHT,
  RECIPE_CONTEXT_LIMIT
};
