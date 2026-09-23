/**
 * Query Expansion and Transformation
 *
 * Improves retrieval by expanding queries with synonyms, related terms,
 * and generating multiple query variations.
 */

import { generateEmbedding } from './embeddings';

export interface ExpandedQuery {
  original: string;
  expanded: string[];
  embeddings?: number[][];
  variations: QueryVariation[];
}

export interface QueryVariation {
  query: string;
  weight: number;
  type: 'synonym' | 'related' | 'general' | 'specific' | 'embedding';
}

// ============================================================================
// Query Expansion Strategies
// ============================================================================

/**
 * Expand query using multiple strategies
 */
export async function expandQuery(
  query: string,
  options: {
    maxVariations?: number;
    useEmbeddings?: boolean;
    domain?: string; // Domain-specific expansion (medical, legal, technical)
  } = {}
): Promise<ExpandedQuery> {
  const {
    maxVariations = 5,
    useEmbeddings = true,
    domain = 'general',
  } = options;

  const variations: QueryVariation[] = [];

  // Strategy 1: Synonym expansion
  const synonyms = await getSynonyms(query, domain);
  variations.push(...synonyms);

  // Strategy 2: Related terms
  const related = await getRelatedTerms(query, domain);
  variations.push(...related);

  // Strategy 3: Generalization (broader terms)
  const generalized = generalizeQuery(query);
  variations.push(...generalized);

  // Strategy 4: Specialization (more specific terms)
  const specialized = specializeQuery(query);
  variations.push(...specialized);

  // Strategy 5: Embedding-based expansion (if enabled)
  if (useEmbeddings) {
    const embeddingVariations = await embeddingBasedExpansion(query, domain);
    variations.push(...embeddingVariations);
  }

  // Deduplicate and limit
  const uniqueVariations = deduplicateVariations(variations);
  const selected = uniqueVariations.slice(0, maxVariations);

  // Generate embeddings for all variations if needed
  let embeddings: number[][] | undefined;
  if (useEmbeddings) {
    embeddings = await Promise.all([
      generateEmbedding(query),
      ...selected.map(v => generateEmbedding(v.query)),
    ]);
  }

  return {
    original: query,
    expanded: selected.map(v => v.query),
    embeddings,
    variations: selected,
  };
}

/**
 * Get synonyms for query terms
 */
async function getSynonyms(
  query: string,
  domain: string
): Promise<QueryVariation[]> {
  const terms = query.toLowerCase().split(/\s+/);
  const variations: QueryVariation[] = [];

  // Domain-specific synonym mappings
  const synonymMap: Record<string, Record<string, string[]>> = {
    // Medical domain
    medical: {
      'pain': ['discomfort', 'ache', 'soreness', 'hurt'],
      'inflammation': ['swelling', 'redness', 'irritation'],
      'medication': ['medicine', 'drug', 'treatment', 'therapy'],
      'symptom': ['sign', 'indication', 'manifestation'],
    },
    // Technical domain
    technical: {
      'bug': ['error', 'issue', 'defect', 'problem'],
      'feature': ['functionality', 'capability', 'option'],
      'code': ['script', 'program', 'implementation'],
      'data': ['information', 'records', 'details'],
    },
    // Legal domain
    legal: {
      'contract': ['agreement', 'document', 'deal'],
      'liability': ['responsibility', 'obligation', 'accountability'],
      'clause': ['provision', 'section', 'term'],
      'party': ['side', 'entity', 'participant'],
    },
    // General
    general: {
      'help': ['assist', 'support', 'aid', 'guide'],
      'find': ['search', 'locate', 'discover', 'identify'],
      'use': ['utilize', 'employ', 'apply', 'leverage'],
      'create': ['make', 'build', 'generate', 'produce'],
      'get': ['obtain', 'acquire', 'retrieve', 'fetch'],
    },
  };

  const domainSynonyms = synonymMap[domain] || synonymMap.general;

  // Replace each term with its synonyms
  terms.forEach((term, index) => {
    const synonyms = domainSynonyms[term];
    if (synonyms) {
      synonyms.forEach(synonym => {
        const newQuery = [...terms];
        newQuery[index] = synonym;
        variations.push({
          query: newQuery.join(' '),
          weight: 0.8,
          type: 'synonym',
        });
      });
    }
  });

  return variations.slice(0, 3); // Limit synonym variations
}

/**
 * Get related terms using word embeddings or knowledge base
 */
async function getRelatedTerms(
  query: string,
  domain: string
): Promise<QueryVariation[]> {
  const variations: QueryVariation[] = [];

  // Domain-specific related terms
  const relatedMap: Record<string, Record<string, string[]>> = {
    medical: {
      'heart': ['cardiac', 'cardiovascular', 'circulatory'],
      'brain': ['neural', 'cerebral', 'cognitive'],
      'lung': ['pulmonary', 'respiratory'],
      'stomach': ['gastric', 'digestive'],
    },
    technical: {
      'database': ['storage', 'repository', 'data store'],
      'api': ['interface', 'endpoint', 'service'],
      'server': ['backend', 'host', 'node'],
      'client': ['frontend', 'application', 'user interface'],
    },
    general: {
      'problem': ['issue', 'challenge', 'difficulty'],
      'solution': ['answer', 'resolution', 'fix'],
      'process': ['procedure', 'method', 'workflow'],
    },
  };

  const domainRelated = relatedMap[domain] || relatedMap.general;
  const terms = query.toLowerCase().split(/\s+/);

  terms.forEach(term => {
    const related = domainRelated[term];
    if (related) {
      related.forEach(relTerm => {
        variations.push({
          query: query.replace(new RegExp(term, 'gi'), relTerm),
          weight: 0.7,
          type: 'related',
        });
      });
    }
  });

  return variations.slice(0, 2);
}

/**
 * Generalize query (make it broader)
 */
function generalizeQuery(query: string): QueryVariation[] {
  const variations: QueryVariation[] = [];
  const lowerQuery = query.toLowerCase();

  // Generalization mappings
  const generalizations: Record<string, string> = {
    // Specific -> General
    'migraine': 'headache',
    'python': 'programming language',
    'javascript': 'programming language',
    'postgresql': 'database',
    'mysql': 'database',
    'covid-19': 'coronavirus',
    'flu': 'influenza',
    'car': 'vehicle',
    'suv': 'vehicle',
    'truck': 'vehicle',
  };

  Object.entries(generalizations).forEach(([specific, general]) => {
    if (lowerQuery.includes(specific)) {
      variations.push({
        query: lowerQuery.replace(new RegExp(specific, 'g'), general),
        weight: 0.6,
        type: 'general',
      });
    }
  });

  return variations;
}

/**
 * Specialize query (make it more specific)
 */
function specializeQuery(query: string): QueryVariation[] {
  const variations: QueryVariation[] = [];
  const lowerQuery = query.toLowerCase();

  // Specialization mappings
  const specializations: Record<string, string[]> = {
    'headache': ['migraine', 'tension headache', 'cluster headache'],
    'database': ['sql database', 'nosql database', 'graph database'],
    'programming': ['web development', 'mobile development', 'data science'],
    'virus': ['coronavirus', 'influenza', 'rhinovirus'],
  };

  Object.entries(specializations).forEach(([general, specifics]) => {
    if (lowerQuery.includes(general)) {
      specifics.forEach(specific => {
        variations.push({
          query: lowerQuery.replace(new RegExp(general, 'g'), specific),
          weight: 0.7,
          type: 'specific',
        });
      });
    }
  });

  return variations;
}

/**
 * Embedding-based query expansion
 * Uses vector similarity to find related queries
 */
async function embeddingBasedExpansion(
  query: string,
  domain: string
): Promise<QueryVariation[]> {
  // In a real implementation, this would:
  // 1. Generate embedding for the query
  // 2. Search a query log / past queries collection for similar queries
  // 3. Return the top similar queries as variations

  // For now, we'll use a simple heuristic approach
  const variations: QueryVariation[] = [];

  // Common query reformulations
  const reformulations = [
    { pattern: /how to (\w+)/, replacement: 'steps to $1' },
    { pattern: /what is (\w+)/, replacement: '$1 definition' },
    { pattern: /why does (.+)/, replacement: 'reasons for $1' },
    { pattern: /best way to/, replacement: 'optimal method for' },
    { pattern: /how do i/, replacement: 'instructions for' },
  ];

  reformulations.forEach(({ pattern, replacement }) => {
    const match = query.match(pattern);
    if (match) {
      variations.push({
        query: query.replace(pattern, replacement),
        weight: 0.75,
        type: 'embedding',
      });
    }
  });

  return variations;
}

/**
 * Remove duplicate variations
 */
function deduplicateVariations(variations: QueryVariation[]): QueryVariation[] {
  const seen = new Set<string>();
  return variations.filter(v => {
    const normalized = v.query.toLowerCase().trim();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

// ============================================================================
// Query Transformation
// ============================================================================

/**
 * Transform query for better retrieval
 */
export interface TransformOptions {
  removeStopwords?: boolean;
  stemWords?: boolean;
  normalizeCase?: boolean;
  expandAbbreviations?: boolean;
  spellCheck?: boolean;
}

export function transformQuery(
  query: string,
  options: TransformOptions = {}
): string {
  const {
    removeStopwords = true,
    stemWords = false,
    normalizeCase = true,
    expandAbbreviations = true,
    spellCheck = false,
  } = options;

  let transformed = query;

  // Normalize case
  if (normalizeCase) {
    transformed = transformed.toLowerCase();
  }

  // Expand abbreviations
  if (expandAbbreviations) {
    transformed = expandAbbreviationsInText(transformed);
  }

  // Remove stopwords
  if (removeStopwords) {
    transformed = removeStopwordsFromText(transformed);
  }

  // Stem words (simplified - in production use Porter stemmer)
  if (stemWords) {
    transformed = stemWordsInText(transformed);
  }

  return transformed.trim();
}

/**
 * Expand common abbreviations
 */
function expandAbbreviationsInText(text: string): string {
  const abbreviations: Record<string, string> = {
    'api': 'application programming interface',
    'ui': 'user interface',
    'ux': 'user experience',
    'db': 'database',
    'ai': 'artificial intelligence',
    'ml': 'machine learning',
    'nlp': 'natural language processing',
    'sql': 'structured query language',
    'nosql': 'not only sql',
    'csv': 'comma separated values',
    'json': 'javascript object notation',
    'xml': 'extensible markup language',
    'html': 'hypertext markup language',
    'css': 'cascading style sheets',
    'js': 'javascript',
    'ts': 'typescript',
    'http': 'hypertext transfer protocol',
    'https': 'hypertext transfer protocol secure',
    'url': 'uniform resource locator',
    'uri': 'uniform resource identifier',
  };

  let expanded = text;
  Object.entries(abbreviations).forEach(([abbr, full]) => {
    expanded = expanded.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), full);
  });

  return expanded;
}

/**
 * Remove stopwords from text
 */
function removeStopwordsFromText(text: string): string {
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
    'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are',
    'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where',
    'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very',
  ]);

  return text
    .split(/\s+/)
    .filter(word => !stopwords.has(word.toLowerCase()))
    .join(' ');
}

/**
 * Simple word stemming (removes common suffixes)
 * In production, use Porter stemmer or similar
 */
function stemWordsInText(text: string): string {
  const suffixes = ['ing', 'ly', 'ed', 'ies', 'es', 's', 'ment', 'ness', 'tion', 'ation'];

  return text
    .split(/\s+/)
    .map(word => {
      for (const suffix of suffixes) {
        if (word.endsWith(suffix) && word.length > suffix.length + 3) {
          return word.slice(0, -suffix.length);
        }
      }
      return word;
    })
    .join(' ');
}

// ============================================================================
// Query Rewriting
// ============================================================================

/**
 * Rewrite query to improve retrieval
 */
export async function rewriteQuery(
  query: string,
  context?: {
    previousQueries?: string[];
    userIntent?: 'informational' | 'navigational' | 'transactional';
    domain?: string;
  }
): Promise<string[]> {
  const rewrites: string[] = [query];

  // Add context-specific rewrites
  if (context?.previousQueries && context.previousQueries.length > 0) {
    // Query clarification
    const lastQuery = context.previousQueries[context.previousQueries.length - 1];
    rewrites.push(`${query} ${lastQuery}`);
  }

  // Intent-specific rewrites
  if (context?.userIntent === 'informational') {
    rewrites.push(`what is ${query}`);
    rewrites.push(`explain ${query}`);
  } else if (context?.userIntent === 'navigational') {
    rewrites.push(`${query} website`);
    rewrites.push(`${query} official page`);
  }

  // Domain-specific rewrites
  if (context?.domain === 'medical') {
    rewrites.push(`${query} symptoms`);
    rewrites.push(`${query} treatment`);
  } else if (context?.domain === 'technical') {
    rewrites.push(`${query} tutorial`);
    rewrites.push(`${query} documentation`);
    rewrites.push(`how to ${query}`);
  }

  return deduplicateVariations(
    rewrites.map(q => ({ query: q, weight: 1, type: 'related' }))
  ).map(v => v.query);
}

// ============================================================================
// Query Understanding
// ============================================================================

/**
 * Extract key phrases from query
 */
export function extractKeyPhrases(query: string): string[] {
  const phrases: string[] = [];

  // Noun phrases (capitalized words)
  const nounPhraseMatches = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
  if (nounPhraseMatches) {
    phrases.push(...nounPhraseMatches);
  }

  // Quoted phrases
  const quotedMatches = query.match(/"([^"]+)"/g);
  if (quotedMatches) {
    phrases.push(...quotedMatches.map(q => q.replace(/"/g, '')));
  }

  // Long words (potential technical terms)
  const longWords = query.match(/\b[a-z]{8,}\b/g);
  if (longWords) {
    phrases.push(...longWords);
  }

  return phrases;
}

/**
 * Detect query type
 */
export function detectQueryType(query: string): {
  type: 'factual' | 'procedural' | 'navigational' | 'exploratory' | 'comparative';
  confidence: number;
} {
  const lowerQuery = query.toLowerCase();

  // Procedural (how-to)
  if (/^(how to|how do i|steps to|instructions for)/.test(lowerQuery)) {
    return { type: 'procedural', confidence: 0.9 };
  }

  // Factual (what is, who is, when did)
  if (/^(what is|who is|when did|where is|define)/.test(lowerQuery)) {
    return { type: 'factual', confidence: 0.85 };
  }

  // Comparative (vs, versus, comparison, difference)
  if (/\b(vs|versus|comparison|difference|better than)\b/.test(lowerQuery)) {
    return { type: 'comparative', confidence: 0.8 };
  }

  // Navigational (looking for a specific resource)
  if (/\b(website|url|link|download|official)\b/.test(lowerQuery)) {
    return { type: 'navigational', confidence: 0.75 };
  }

  // Exploratory (general questions)
  if (/^(tell me|explain|describe|discuss)/.test(lowerQuery)) {
    return { type: 'exploratory', confidence: 0.7 };
  }

  // Default to exploratory
  return { type: 'exploratory', confidence: 0.5 };
}
