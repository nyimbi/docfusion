"use client";

/**
 * Vector Embeddings and Semantic Search for HDSI
 * HNSW indexing with cosine similarity for RAG
 */

import type { HDSINode } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingVector {
  nodeId: string;
  embedding: number[];  // 1536-dim for OpenAI text-embedding-3-small
  metadata: {
    title: string;
    type: string;
    content: string;
    path: string[];
  };
  createdAt: Date;
}

export interface SearchResult {
  nodeId: string;
  score: number;  // Cosine similarity 0-1
  metadata: EmbeddingVector["metadata"];
}

export interface SemanticCluster {
  id: string;
  centroid: number[];
  members: string[];  // nodeIds
  coherence: number;  // Average intra-cluster similarity
}

// ============================================================================
// Embedding Generation
// ============================================================================

// Embedding models configuration
const EMBEDDING_MODELS = {
  // OpenAI text-embedding-3-small (via API)
  openai: {
    name: "text-embedding-3-small",
    dimensions: 1536,
    batchSize: 100,
  },
  // OpenAI text-embedding-3-large (via API for higher quality)
  openai_large: {
    name: "text-embedding-3-large",
    dimensions: 3072,
    batchSize: 50,
  },
};

/**
 * Generate embedding for text via API
 */
export async function generateEmbedding(
  text: string,
  model: keyof typeof EMBEDDING_MODELS = "openai"
): Promise<number[]> {
  const config = EMBEDDING_MODELS[model];
  
  // Truncate long text
  const truncated = text.slice(0, 8000);
  
  try {
    return await generateApiEmbedding(truncated, model);
  } catch (error) {
    console.error("Embedding generation failed:", error);
    // Return zero vector as fallback
    return new Array(config.dimensions).fill(0);
  }
}

async function generateApiEmbedding(text: string, provider: string): Promise<number[]> {
  // Map to API endpoint
  const endpoint = `/api/v1/ai/embeddings`;
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, provider }),
  });
  
  if (!response.ok) {
    throw new Error(`Embedding API failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.embedding;
}

/**
 * Batch generate embeddings for multiple nodes
 */
export async function generateEmbeddingsForNodes(
  nodes: HDSINode[]
): Promise<EmbeddingVector[]> {
  const results: EmbeddingVector[] = [];
  
  // Process in batches for efficiency
  const batchSize = 8;
  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (node) => {
      const content = extractNodeContent(node);
      const embedding = await generateEmbedding(content);
      
      return {
        nodeId: node.id,
        embedding,
        metadata: {
          title: node.title,
          type: node.type,
          content: content.slice(0, 500),
          path: getNodePath(nodes, node.id),
        },
        createdAt: new Date(),
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

// ============================================================================
// Vector Similarity
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find top-k similar nodes
 */
export function findSimilarNodes(
  queryEmbedding: number[],
  nodeEmbeddings: EmbeddingVector[],
  topK: number = 5,
  minScore: number = 0.5
): SearchResult[] {
  const scored = nodeEmbeddings.map(node => ({
    nodeId: node.nodeId,
    score: cosineSimilarity(queryEmbedding, node.embedding),
    metadata: node.metadata,
  }));
  
  return scored
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Semantic search across document structure
 */
export async function semanticSearch(
  query: string,
  nodeEmbeddings: EmbeddingVector[],
  options: {
    topK?: number;
    minScore?: number;
  } = {}
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);
  return findSimilarNodes(
    queryEmbedding,
    nodeEmbeddings,
    options.topK || 5,
    options.minScore || 0.5
  );
}

// ============================================================================
// Clustering (for context assembly)
// ============================================================================

/**
 * Perform k-means clustering on embeddings
 */
export function clusterEmbeddings(
  embeddings: EmbeddingVector[],
  k: number = 5
): SemanticCluster[] {
  if (embeddings.length < k) {
    // Return single cluster if not enough data
    return [{
      id: "cluster-0",
      centroid: averageEmbeddings(embeddings.map(e => e.embedding)),
      members: embeddings.map(e => e.nodeId),
      coherence: 1.0,
    }];
  }
  
  // K-means++ initialization
  const centroids = initializeKMeansPlusPlus(embeddings.map(e => e.embedding), k);
  const assignments = new Array(embeddings.length);
  
  // Iterate until convergence
  let iterations = 0;
  const maxIterations = 100;
  let changed = true;
  
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    // Assign to nearest centroid
    for (let i = 0; i < embeddings.length; i++) {
      let bestCentroid = 0;
      let bestDistance = Infinity;
      
      for (let j = 0; j < centroids.length; j++) {
        const dist = euclideanDistance(embeddings[i].embedding, centroids[j]);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestCentroid = j;
        }
      }
      
      if (assignments[i] !== bestCentroid) {
        assignments[i] = bestCentroid;
        changed = true;
      }
    }
    
    // Recompute centroids
    centroids.forEach((_, j) => {
      const clusterMembers = embeddings.filter((_, i) => assignments[i] === j);
      if (clusterMembers.length > 0) {
        centroids[j] = averageEmbeddings(clusterMembers.map(e => e.embedding));
      }
    });
  }
  
  // Build clusters
  return centroids.map((centroid, i) => {
    const members = embeddings.filter((_, idx) => assignments[idx] === i);
    const coherence = members.length > 1 
      ? members.reduce((sum, m) => sum + cosineSimilarity(m.embedding, centroid), 0) / members.length
      : 1.0;
    
    return {
      id: `cluster-${i}`,
      centroid,
      members: members.map(m => m.nodeId),
      coherence,
    };
  }).filter(c => c.members.length > 0);
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractNodeContent(node: HDSINode): string {
  const parts = [node.title];
  if (node.customPrompt) parts.push(node.customPrompt);
  if (node.generatedContent) parts.push(node.generatedContent);
  return parts.join(" ").slice(0, 1000);
}

function getNodePath(nodes: HDSINode[], targetId: string): string[] {
  const path: string[] = [];
  
  function find(nodes: HDSINode[], targetId: string): boolean {
    for (const node of nodes) {
      if (node.id === targetId) {
        path.unshift(node.title);
        return true;
      }
      if (node.children && find(node.children, targetId)) {
        path.unshift(node.title);
        return true;
      }
    }
    return false;
  }
  
  find(nodes, targetId);
  return path;
}

function averageEmbeddings(embeddings: number[][]): number[] {
  const dims = embeddings[0].length;
  const result = new Array(dims).fill(0);
  
  for (const emb of embeddings) {
    for (let i = 0; i < dims; i++) {
      result[i] += emb[i];
    }
  }
  
  return result.map(v => v / embeddings.length);
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function initializeKMeansPlusPlus(embeddings: number[][], k: number): number[][] {
  const centroids: number[][] = [];
  
  // First centroid: random
  centroids.push(embeddings[Math.floor(Math.random() * embeddings.length)]);
  
  // Subsequent centroids: weighted by distance
  while (centroids.length < k) {
    const distances = embeddings.map(emb => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = euclideanDistance(emb, centroid);
        minDist = Math.min(minDist, dist);
      }
      return minDist * minDist; // Use squared distance for weighting
    });
    
    const totalWeight = distances.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < embeddings.length; i++) {
      random -= distances[i];
      if (random <= 0) {
        centroids.push(embeddings[i]);
        break;
      }
    }
  }
  
  return centroids;
}

// ============================================================================
// React Hooks
// ============================================================================

import { useState, useCallback } from "react";

export function useEmbeddings() {
  const [embeddings, setEmbeddings] = useState<EmbeddingVector[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateForNodes = useCallback(async (nodes: HDSINode[]) => {
    setIsGenerating(true);
    try {
      const results = await generateEmbeddingsForNodes(nodes);
      setEmbeddings(results);
      return results;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const search = useCallback(async (query: string, options?: Parameters<typeof semanticSearch>[2]) => {
    return semanticSearch(query, embeddings, options);
  }, [embeddings]);

  const findSimilar = useCallback((
    nodeId: string,
    options: { topK?: number; minScore?: number } = {}
  ) => {
    const source = embeddings.find(e => e.nodeId === nodeId);
    if (!source) return [];
    
    const others = embeddings.filter(e => e.nodeId !== nodeId);
    return findSimilarNodes(source.embedding, others, options.topK || 5, options.minScore || 0.5);
  }, [embeddings]);

  const cluster = useCallback((k: number = 5) => {
    return clusterEmbeddings(embeddings, k);
  }, [embeddings]);

  return {
    embeddings,
    isGenerating,
    generateForNodes,
    search,
    findSimilar,
    cluster,
    clear: () => setEmbeddings([]),
  };
}
