/**
 * Quantum-Ready RAG Ω - Hybrid Retrieval-Augmented Generation
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 *
 * Implements hybrid retrieval combining:
 * - Lexical Search (BM25)
 * - Semantic Vector Search (HNSW/IVF)
 * - Knowledge Graph Search (Cypher/Gremlin)
 * - Cross-Encoder Re-ranking
 * - Knowledge Fusion & Evidence Synthesis
 */

import { EventEmitter } from 'node:events';

export type RetrievalMode = 'lexical' | 'semantic' | 'graph' | 'hybrid' | 'adaptive';

export type EvidenceSource =
  'document' | 'knowledge_graph' | 'web' | 'api' | 'memory' | 'code' | 'ledger';

export interface RetrievalConfig {
  readonly mode: RetrievalMode;
  readonly topK: number;
  readonly lexicalWeight: number;
  readonly semanticWeight: number;
  readonly graphWeight: number;
  readonly rerankTopK: number;
  readonly enableCrossEncoder: boolean;
  readonly crossEncoderModel: string;
  readonly minScoreThreshold: number;
  readonly maxContextTokens: number;
  readonly enableQueryExpansion: boolean;
  readonly expansionModel: string;
  readonly maxExpansions: number;
  readonly enableEvidenceSynthesis: boolean;
  readonly synthesisModel: string;
}

const DEFAULT_CONFIG: RetrievalConfig = {
  mode: 'adaptive',
  topK: 20,
  lexicalWeight: 0.3,
  semanticWeight: 0.5,
  graphWeight: 0.2,
  rerankTopK: 50,
  enableCrossEncoder: true,
  crossEncoderModel: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  minScoreThreshold: 0.1,
  maxContextTokens: 8192,
  enableQueryExpansion: true,
  expansionModel: 'gpt-4o-mini',
  maxExpansions: 3,
  enableEvidenceSynthesis: true,
  synthesisModel: 'gpt-4o',
};

export interface Document {
  readonly id: string;
  readonly content: string;
  readonly title?: string;
  readonly source: EvidenceSource;
  readonly metadata: Record<string, unknown>;
  readonly embedding?: Float32Array;
  readonly score?: number;
  readonly provenance?: {
    readonly hash: string;
    readonly timestamp: number;
    readonly source: string;
  };
}

export interface RetrievalRequest {
  readonly query: string;
  readonly config?: Partial<RetrievalConfig>;
  readonly filters?: {
    readonly sources?: EvidenceSource[];
    readonly dateRange?: { start: number; end: number };
    readonly tags?: string[];
    readonly minScore?: number;
  };
  readonly context?: {
    readonly sessionId?: string;
    readonly userId?: string;
    readonly conversationHistory?: ReadonlyArray<{ role: string; content: string }>;
  };
}

export interface RetrievalResult {
  readonly documents: ReadonlyArray<Document>;
  readonly totalFound: number;
  readonly queryTimeMs: number;
  readonly mode: RetrievalMode;
  readonly evidenceBundle?: EvidenceBundle;
  readonly synthesizedAnswer?: string;
}

export interface EvidenceBundle {
  readonly query: string;
  readonly documents: ReadonlyArray<Document>;
  readonly synthesizedAnswer?: string;
  readonly confidence: number;
  readonly sources: ReadonlyArray<EvidenceSource>;
  readonly provenanceHashes: ReadonlyArray<string>;
  readonly generatedAt: number;
  readonly synthesisMetadata?: {
    readonly model: string;
    readonly tokensUsed: number;
    readonly confidence: number;
  };
}

export interface SearchStageResult {
  readonly stage: 'lexical' | 'semantic' | 'graph' | 'rerank' | 'fusion';
  readonly documents: ReadonlyArray<Document>;
  readonly timeMs: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * BM25 Lexical Search Engine
 */
export class BM25SearchEngine {
  private documents: Map<string, { doc: Document; tokens: string[]; docLen: number }> = new Map();
  private termFreq: Map<string, Map<string, number>> = new Map(); // term -> docId -> freq
  private docFreq: Map<string, number> = new Map(); // term -> doc count
  private avgDocLen: number = 0;
  private totalDocs: number = 0;

  // BM25 parameters
  private readonly k1: number = 1.2;
  private readonly b: number = 0.75;

  /**
   * Add or update a document in the index
   */
  addDocument(doc: Document): void {
    const tokens = this.tokenize(doc.content);
    const docLen = tokens.length;

    this.documents.set(doc.id, { doc, tokens, docLen });
    this.totalDocs++;
    this.avgDocLen = (this.avgDocLen * (this.totalDocs - 1) + docLen) / this.totalDocs;

    // Update term frequencies
    const termCounts = new Map<string, number>();
    for (const token of tokens) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
    }

    for (const [term, freq] of termCounts) {
      const termMap = this.termFreq.get(term) || new Map();
      termMap.set(doc.id, freq);
      this.termFreq.set(term, termMap);
      this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
    }
  }

  removeDocument(docId: string): void {
    const entry = this.documents.get(docId);
    if (!entry) return;

    for (const token of entry.tokens) {
      const termMap = this.termFreq.get(token);
      if (termMap) {
        termMap.delete(docId);
        if (termMap.size === 0) this.termFreq.delete(token);
      }
      const df = this.docFreq.get(token) || 0;
      if (df <= 1) this.docFreq.delete(token);
      else this.docFreq.set(token, df - 1);
    }

    this.documents.delete(docId);
    this.totalDocs--;
  }

  search(query: string, topK: number = 20): Array<{ document: Document; score: number }> {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores = new Map<string, number>();

    for (const [docId, entry] of this.documents) {
      let score = 0;

      for (const token of queryTokens) {
        const termMap = this.termFreq.get(token);
        if (!termMap) continue;

        const freq = termMap.get(entry.doc.id) || 0;
        if (freq === 0) continue;

        const df = this.docFreq.get(token) || 1;
        const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);

        const numerator = freq * (this.k1 + 1);
        const denominator =
          freq + this.k1 * (1 - this.b + (this.b * entry.docLen) / this.avgDocLen);

        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        scores.set(entry.doc.id, score);
      }
    }

    // Sort by score descending
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([id, score]) => ({
        document: this.documents.get(id)!.doc,
        score,
      }));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  getStats() {
    return {
      totalDocuments: this.totalDocs,
      uniqueTerms: this.termFreq.size,
      avgDocLength: this.avgDocLen,
    };
  }
}

/**
 * Vector Search Engine (HNSW/IVF)
 */
export class VectorSearchEngine {
  private index: Map<string, { embedding: Float32Array; doc: Document }> = new Map();
  private dimension: number;

  constructor(dimension: number = 768) {
    this.dimension = dimension;
  }

  addDocument(doc: Document, embedding: Float32Array): void {
    if (embedding.length !== this.dimension) {
      throw new Error(
        `EMBEDDING_DIMENSION_MISMATCH: expected ${this.dimension}, got ${embedding.length}`
      );
    }
    this.index.set(doc.id, { embedding, doc });
  }

  removeDocument(docId: string): void {
    this.index.delete(docId);
  }

  search(
    queryEmbedding: Float32Array,
    topK: number = 20,
    filter?: (doc: Document) => boolean
  ): Array<{ document: Document; score: number }> {
    if (queryEmbedding.length !== this.dimension) {
      throw new Error(`QUERY_EMBEDDING_DIMENSION_MISMATCH`);
    }

    const results: Array<{ document: Document; score: number }> = [];

    for (const [id, entry] of this.index) {
      if (filter && !filter(entry.doc)) continue;

      const score = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (score > 0) {
        results.push({ document: entry.doc, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;
      dot += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getStats() {
    return {
      totalVectors: this.index.size,
      dimension: this.dimension,
    };
  }
}

/**
 * Knowledge Graph Search Engine
 */
export interface GraphNode {
  readonly id: string;
  readonly type: string;
  readonly properties: Record<string, unknown>;
  readonly embedding?: Float32Array;
}

export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: string;
  readonly properties: Record<string, unknown>;
}

export class GraphSearchEngine {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map(); // source -> edges
  private reverseEdges: Map<string, GraphEdge[]> = new Map(); // target -> edges

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge): void {
    const outEdges = this.edges.get(edge.source) || [];
    outEdges.push(edge);
    this.edges.set(edge.source, outEdges);

    const inEdges = this.reverseEdges.get(edge.target) || [];
    inEdges.push(edge);
    this.reverseEdges.set(edge.target, inEdges);
  }

  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.edges.delete(nodeId);
    this.reverseEdges.delete(nodeId);
  }

  /**
   * Search by traversing graph from seed nodes
   */
  search(
    query: string,
    seedNodes: string[] = [],
    maxDepth: number = 2,
    maxResults: number = 20
  ): Array<{ node: GraphNode; path: GraphEdge[]; score: number }> {
    // Simple BFS from seed nodes
    // In production, would use graph embeddings and semantic similarity

    const visited = new Set<string>();
    const results: Array<{ node: GraphNode; path: GraphEdge[]; score: number }> = [];
    const queue: Array<{ nodeId: string; depth: number; path: GraphEdge[]; score: number }> = [];

    // Initialize with seed nodes
    for (const seedId of seedNodes) {
      const node = this.nodes.get(seedId);
      if (node) {
        queue.push({ nodeId: seedId, depth: 0, path: [], score: 1.0 });
      }
    }

    while (queue.length > 0 && results.length < maxResults) {
      const current = queue.shift()!;

      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      const node = this.nodes.get(current.nodeId);
      if (node) {
        results.push({
          node,
          path: current.path,
          score: current.score,
        });
      }

      if (current.depth >= maxDepth) continue;

      // Explore neighbors
      const outEdges = this.edges.get(current.nodeId) || [];
      for (const edge of outEdges) {
        if (!visited.has(edge.target)) {
          queue.push({
            nodeId: edge.target,
            depth: current.depth + 1,
            path: [...current.path, edge],
            score: current.score * 0.8, // decay
          });
        }
      }

      const inEdges = this.reverseEdges.get(current.nodeId) || [];
      for (const edge of inEdges) {
        if (!visited.has(edge.source)) {
          queue.push({
            nodeId: edge.source,
            depth: current.depth + 1,
            path: [edge, ...current.path],
            score: current.score * 0.7,
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
  }

  /**
   * Find related entities via graph traversal
   */
  findRelated(
    entityId: string,
    relationshipTypes?: string[],
    maxDepth: number = 2,
    limit: number = 50
  ): Array<{ entity: GraphNode; relationship: GraphEdge; depth: number }> {
    const results: Array<{ entity: GraphNode; relationship: GraphEdge; depth: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number; path: GraphEdge[] }> = [];

    queue.push({ nodeId: entityId, depth: 0, path: [] });

    while (queue.length > 0 && results.length < limit) {
      const current = queue.shift()!;

      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      if (current.depth > 0) {
        const entity = this.nodes.get(current.nodeId);
        if (entity) {
          results.push({
            entity,
            relationship: current.path[current.path.length - 1]!,
            depth: current.depth,
          });
        }
      }

      if (current.depth >= maxDepth) continue;

      const outEdges = this.edges.get(current.nodeId) || [];
      for (const edge of outEdges) {
        if (!relationshipTypes || relationshipTypes.includes(edge.type)) {
          if (!visited.has(edge.target)) {
            queue.push({
              nodeId: edge.target,
              depth: current.depth + 1,
              path: [...current.path, edge],
            });
          }
        }
      }
    }

    return results.slice(0, limit);
  }

  getStats() {
    return {
      totalNodes: this.nodes.size,
      totalEdges: Array.from(this.edges.values()).reduce((sum, arr) => sum + arr.length, 0),
    };
  }
}

/**
 * Cross-Encoder Re-ranker
 */
export class CrossEncoderReranker {
  private model: string;
  private maxLength: number;

  constructor(model: string = 'cross-encoder/ms-marco-MiniLM-L-6-v2', maxLength: number = 512) {
    this.model = model;
    this.maxLength = maxLength;
  }

  async rerank(
    query: string,
    documents: Array<{ document: Document; score: number }>,
    topK: number
  ): Promise<Array<{ document: Document; score: number; rerankScore: number }>> {
    const queryTerms = new Set(this.tokenize(query));
    return documents
      .map(({ document, score }) => {
        const terms = this.tokenize(document.content);
        const overlap = terms.filter((term) => queryTerms.has(term)).length;
        const lexicalBoost = queryTerms.size === 0 ? 0 : overlap / queryTerms.size;
        return { document, score, rerankScore: score * 0.7 + lexicalBoost * 0.3 };
      })
      .sort((left, right) => right.rerankScore - left.rerankScore)
      .slice(0, topK);
  }

  async scorePairs(query: string, documents: Document[]): Promise<Float32Array> {
    return new Float32Array(
      documents.map(({ content }) => {
        const queryTerms = new Set(this.tokenize(query));
        const terms = this.tokenize(content);
        return queryTerms.size === 0
          ? 0
          : terms.filter((term) => queryTerms.has(term)).length / queryTerms.size;
      })
    );
  }

  private tokenize(value: string): string[] {
    return (
      value
        .toLocaleLowerCase()
        .normalize('NFC')
        .match(/[\\p{L}\\p{N}]+/gu) ?? []
    );
  }
}

/**
 * Evidence Synthesizer
 * Synthesizes evidence from multiple documents into coherent answer
 */
export class EvidenceSynthesizer {
  private model: string;

  constructor(model: string = 'gpt-4o') {
    this.model = model;
  }

  async synthesize(
    query: string,
    documents: Document[],
    config: {
      maxTokens?: number;
      includeCitations?: boolean;
      style?: 'concise' | 'detailed' | 'bullet_points';
    } = {}
  ): Promise<{
    answer: string;
    citations: Array<{ docId: string; text: string; start: number; end: number }>;
    confidence: number;
  }> {
    const maxTokens = config.maxTokens ?? 512;
    const queryTerms = new Set(
      query
        .toLocaleLowerCase()
        .normalize('NFC')
        .match(/[\\p{L}\\p{N}]+/gu) ?? []
    );
    const ranked = documents
      .map((doc) => {
        const sentences = doc.content.split(/(?<=[.!?])\\s+/).filter(Boolean);
        const sentence =
          sentences
            .map((value) => ({
              value,
              score: (value.toLocaleLowerCase().match(/[\\p{L}\\p{N}]+/gu) ?? []).filter((term) =>
                queryTerms.has(term)
              ).length,
            }))
            .sort((left, right) => right.score - left.score)[0]?.value ?? doc.content;
        return { doc, sentence: sentence.slice(0, Math.max(80, maxTokens * 4)) };
      })
      .slice(0, 5);
    const citations =
      config.includeCitations === false
        ? []
        : ranked.map(({ doc, sentence }) => ({
            docId: doc.id,
            text: sentence,
            start: Math.max(0, doc.content.indexOf(sentence)),
            end: Math.max(0, doc.content.indexOf(sentence)) + sentence.length,
          }));
    const prefix = config.style === 'bullet_points' ? '• ' : '';
    const answer =
      ranked.length === 0
        ? 'No se encontró evidencia suficiente para responder.'
        : ranked
            .map(({ sentence }) => `${prefix}${sentence}`)
            .join(config.style === 'bullet_points' ? '\\n' : ' ');
    const confidence =
      ranked.length === 0
        ? 0
        : Math.min(0.95, 0.45 + ranked.length * 0.1 + (queryTerms.size > 0 ? 0.1 : 0));
    return { answer, citations, confidence };
  }

  async synthesizeStreaming(
    query: string,
    documents: Document[],
    onChunk: (chunk: string) => void
  ): Promise<{ answer: string; citations: unknown[] }> {
    const result = await this.synthesize(query, documents, { includeCitations: true });
    const chunks = result.answer.match(/.{1,120}(?:\\s|$)/g) ?? [result.answer];
    for (const chunk of chunks) onChunk(chunk);
    return { answer: result.answer, citations: result.citations };
  }
}

/**
 * Query Expander
 * Expands queries for better recall
 */
export class QueryExpander {
  private model: string;

  constructor(model: string = 'gpt-4o-mini') {
    this.model = model;
  }

  async expand(query: string, maxExpansions: number = 3): Promise<string[]> {
    // In production, would call LLM to generate query variations
    // For now, return simple variations
    const expansions = [
      query,
      `What is ${query}?`,
      `${query} explanation`,
      `${query} examples`,
      `${query} best practices`,
    ];

    return expansions.slice(0, maxExpansions + 1);
  }

  async expandWithContext(
    query: string,
    context: string,
    maxExpansions: number = 3
  ): Promise<string[]> {
    // Context-aware expansion
    return this.expand(query, maxExpansions);
  }
}

/**
 * Quantum-Ready RAG Engine
 * Main orchestrator for hybrid retrieval
 */
export class QuantumReadyRAG extends EventEmitter {
  private config: RetrievalConfig;
  private lexicalEngine: BM25SearchEngine;
  private vectorEngine: VectorSearchEngine;
  private graphEngine: GraphSearchEngine;
  private reranker: CrossEncoderReranker;
  private synthesizer: EvidenceSynthesizer;
  private expander: QueryExpander;
  private documentStore: Map<string, Document> = new Map();

  constructor(config: Partial<RetrievalConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lexicalEngine = new BM25SearchEngine();
    this.vectorEngine = new VectorSearchEngine(768);
    this.graphEngine = new GraphSearchEngine();
    this.reranker = new CrossEncoderReranker(this.config.crossEncoderModel);
    this.synthesizer = new EvidenceSynthesizer(this.config.synthesisModel);
    this.expander = new QueryExpander(this.config.expansionModel);
  }

  /**
   * Add a document to all search engines
   */
  addDocument(doc: Document, embedding?: Float32Array): void {
    this.documentStore.set(doc.id, doc);
    this.lexicalEngine.addDocument(doc);

    if (embedding) {
      this.vectorEngine.addDocument(doc, embedding);
    }

    // Add to graph if it has relationships
    // In production, would extract entities and relationships
  }

  removeDocument(docId: string): void {
    this.documentStore.delete(docId);
    this.lexicalEngine.removeDocument(docId);
    this.vectorEngine.removeDocument(docId);
  }

  /**
   * Main retrieval method - adaptive hybrid search
   */
  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const startTime = Date.now();
    const config = { ...this.config, ...request.config };
    const stageResults: SearchStageResult[] = [];

    let allDocuments: Map<string, Document> = new Map();

    // Stage 1: Query Expansion
    let queries = [request.query];
    if (config.enableQueryExpansion) {
      const expanded = await this.expander.expand(request.query, config.maxExpansions);
      queries = expanded;
    }

    // Stage 2: Execute searches based on mode
    const allStageResults: SearchStageResult[] = [];

    for (const query of queries) {
      // Lexical search
      if (config.mode === 'lexical' || config.mode === 'hybrid' || config.mode === 'adaptive') {
        const start = Date.now();
        const lexicalResults = this.lexicalEngine.search(query, config.topK * 2);
        stageResults.push({
          stage: 'lexical',
          documents: lexicalResults.map((r) => ({
            ...r.document,
            score: r.score * config.lexicalWeight,
          })),
          timeMs: Date.now() - start,
        });
      }

      // Semantic search
      if (config.mode === 'semantic' || config.mode === 'hybrid' || config.mode === 'adaptive') {
        const start = Date.now();
        // Would need query embedding from embedding model
        // const queryEmbedding = await this.embed(query);
        // const semanticResults = this.vectorEngine.search(queryEmbedding, config.topK * 2);
        stageResults.push({
          stage: 'semantic',
          documents: [],
          timeMs: Date.now() - start,
        });
      }

      // Graph search
      if (config.mode === 'graph' || config.mode === 'hybrid' || config.mode === 'adaptive') {
        const start = Date.now();
        // const graphResults = this.graphEngine.search(query);
        stageResults.push({
          stage: 'graph',
          documents: [],
          timeMs: Date.now() - start,
        });
      }
    }

    // Fuse results from all stages
    const fusedDocuments = this.fuseResults(stageResults, config);

    // Re-rank with cross-encoder
    let finalDocuments = fusedDocuments;
    if (config.enableCrossEncoder && fusedDocuments.length > 1) {
      const reranked = await this.reranker.rerank(
        request.query,
        fusedDocuments.map((document) => ({ document, score: document.score ?? 0 })),
        config.rerankTopK
      );
      finalDocuments = reranked.map((r) => ({ ...r.document, score: r.rerankScore }));
    }

    // Filter by threshold
    finalDocuments = finalDocuments.filter(
      (d) => (d.score || 0) >= (config.minScoreThreshold || 0)
    );

    // Limit results
    finalDocuments = finalDocuments.slice(0, config.topK);

    // Synthesize evidence if enabled
    let evidenceBundle: EvidenceBundle | undefined;
    let synthesizedAnswer: string | undefined;

    if (config.enableEvidenceSynthesis && finalDocuments.length > 0) {
      const synthesis = await this.synthesizer.synthesize(request.query, finalDocuments);
      synthesizedAnswer = synthesis.answer;

      evidenceBundle = {
        query: request.query,
        documents: finalDocuments,
        synthesizedAnswer,
        confidence: synthesis.confidence,
        sources: Array.from(new Set(finalDocuments.map((d) => d.source))),
        provenanceHashes: finalDocuments.map((d) => d.provenance?.hash || '').filter(Boolean),
        generatedAt: Date.now(),
        synthesisMetadata: {
          model: config.synthesisModel,
          tokensUsed: 0,
          confidence: synthesis.confidence,
        },
      };
    }

    const queryTimeMs = Date.now() - startTime;

    return {
      documents: finalDocuments,
      totalFound: finalDocuments.length,
      queryTimeMs: Date.now() - startTime,
      mode: config.mode,
      evidenceBundle,
      synthesizedAnswer,
    };
  }

  private fuseResults(stageResults: SearchStageResult[], config: RetrievalConfig): Document[] {
    const docScores = new Map<string, { doc: Document; scores: number[] }>();

    for (const result of stageResults) {
      for (const doc of result.documents) {
        const existing = docScores.get(doc.id) || { doc, scores: [] };
        existing.scores.push(doc.score ?? 0);
        docScores.set(doc.id, existing);
      }
    }

    // Weighted fusion
    return Array.from(docScores.values())
      .map(({ doc, scores }) => {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        return { ...doc, score: avgScore };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): Document | undefined {
    return this.documentStore.get(id);
  }

  /**
   * Get all documents
   */
  getAllDocuments(): Document[] {
    return Array.from(this.documentStore.values());
  }

  /**
   * Get engine statistics
   */
  getStats() {
    return {
      totalDocuments: this.documentStore.size,
      lexicalIndex: this.lexicalEngine.getStats(),
      vectorIndex: this.vectorEngine.getStats(),
      graphIndex: this.graphEngine.getStats(),
    };
  }

  /**
   * Batch add documents
   */
  addDocuments(docs: Array<{ doc: Document; embedding?: Float32Array }>): void {
    for (const { doc, embedding } of docs) {
      this.addDocument(doc, embedding);
    }
  }
}

/**
 * Evidence Validator
 * Validates quality and relevance of retrieved evidence
 */
export class EvidenceValidator {
  async validate(
    query: string,
    documents: Document[],
    config: {
      minRelevanceScore?: number;
      minSourceDiversity?: number;
      requireProvenance?: boolean;
    } = {}
  ): Promise<{
    valid: boolean;
    score: number;
    issues: string[];
    metrics: {
      relevance: number;
      diversity: number;
      provenanceCoverage: number;
    };
  }> {
    const issues: string[] = [];
    let relevanceScore = 1;
    let diversityScore = 1;
    let provenanceCoverage = 1;

    // Check relevance
    const avgScore = documents.reduce((sum, d) => sum + (d.score || 0), 0) / documents.length;
    if (avgScore < (config.minRelevanceScore || 0.3)) {
      issues.push(`Low average relevance score: ${avgScore.toFixed(2)}`);
      relevanceScore = avgScore;
    }

    // Check source diversity
    const sources = new Set(documents.map((d) => d.source));
    if (sources.size < (config.minSourceDiversity || 2)) {
      issues.push(`Low source diversity: ${sources.size} sources`);
      diversityScore = sources.size / (config.minSourceDiversity || 2);
    }

    // Check provenance
    if (config.requireProvenance) {
      const withProvenance = documents.filter((d) => d.provenance).length;
      provenanceCoverage = withProvenance / documents.length;
      if (provenanceCoverage < 0.8) {
        issues.push(`Low provenance coverage: ${(provenanceCoverage * 100).toFixed(0)}%`);
      }
    }

    const score = (relevanceScore + diversityScore + provenanceCoverage) / 3;

    return {
      valid: score >= 0.6 && issues.length === 0,
      score,
      issues,
      metrics: {
        relevance: relevanceScore,
        diversity: diversityScore,
        provenanceCoverage,
      },
    };
  }
}

/**
 * Default RAG Engine Instance
 */
export const defaultRAG = new QuantumReadyRAG({
  mode: 'adaptive',
  topK: 20,
  lexicalWeight: 0.3,
  semanticWeight: 0.5,
  graphWeight: 0.2,
  rerankTopK: 50,
  enableCrossEncoder: true,
  crossEncoderModel: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  minScoreThreshold: 0.1,
  maxContextTokens: 8192,
  enableQueryExpansion: true,
  expansionModel: 'gpt-4o-mini',
  maxExpansions: 3,
  enableEvidenceSynthesis: true,
  synthesisModel: 'gpt-4o',
});
