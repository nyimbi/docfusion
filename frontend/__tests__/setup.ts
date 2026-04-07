/**
 * Test Setup for HDSI
 * 
 * Configures the testing environment for HDSI tests.
 */

import { vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mock crypto.randomUUID
// ============================================================================

let uuidCounter = 0;

Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => `mock-uuid-${++uuidCounter}`,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});

// ============================================================================
// Mock IndexedDB
// ============================================================================

vi.mock("@/lib/hdsi/db", async () => {
  const { createDocument, createNode, createTree } = await import("./utils/factories");
  
  // In-memory storage for tests
  const storage = new Map<string, any>();
  
  return {
    hdsiDB: {
      createDocument: vi.fn(async (title, structure, options) => {
        const doc = createDocument({ title, structure, ...options });
        storage.set(doc.id, doc);
        return doc;
      }),
      
      getDocument: vi.fn(async (id) => {
        return storage.get(id) ?? null;
      }),
      
      saveDocument: vi.fn(async (id, structure, title, options) => {
        const existing = storage.get(id);
        const updated = {
          ...existing,
          id,
          structure,
          title: title ?? existing?.title ?? "Untitled",
          updatedAt: new Date(),
          syncVersion: (existing?.syncVersion ?? 0) + 1,
        };
        storage.set(id, updated);
        return updated;
      }),
      
      deleteDocument: vi.fn(async (id, soft = true) => {
        if (soft) {
          const doc = storage.get(id);
          if (doc) {
            storage.set(id, { ...doc, isDeleted: true });
          }
        } else {
          storage.delete(id);
        }
      }),
      
      listDocuments: vi.fn(async (options) => {
        const docs = Array.from(storage.values());
        if (!options?.includeDeleted) {
          return docs.filter((d) => !d.isDeleted);
        }
        return docs;
      }),
      
      getNodeCount: vi.fn(async (id) => {
        const doc = storage.get(id);
        if (!doc) return 0;
        
        const count = (nodes: any[]): number => 
          nodes.reduce((acc, n) => acc + 1 + count(n.children ?? []), 0);
        
        return count(doc.structure);
      }),
      
      // Version management
      versions: new Map(),
      
      createVersion: vi.fn(async (documentId, structure, options) => {
        const version = {
          id: `ver-${++uuidCounter}`,
          documentId,
          structure: JSON.parse(JSON.stringify(structure)),
          author: options.author ?? "test",
          description: options.description ?? "Test version",
          timestamp: new Date(),
          isAutoSave: options.isAutoSave ?? false,
        };
        
        const docVersions = (globalThis as any).testVersions?.get(documentId) ?? [];
        docVersions.push(version);
        (globalThis as any).testVersions = (globalThis as any).testVersions ?? new Map();
        (globalThis as any).testVersions.set(documentId, docVersions);
        
        return version;
      }),
      
      getDocumentVersions: vi.fn(async (documentId) => {
        return (globalThis as any).testVersions?.get(documentId) ?? [];
      }),
      
      // Auto-save mock
      createAutoSave: vi.fn((documentId, getStructure, intervalMs) => {
        return {
          triggerSave: vi.fn(),
          dispose: vi.fn(),
        };
      }),
    },
    
    unflattenNodes: vi.fn((flatNodes: any[]) => {
      // Simple unflatten for tests
      const nodeMap = new Map<string, any>(flatNodes.map((n: any) => [n.id, { ...n, children: [] }]));
      const roots: any[] = [];
      
      for (const node of flatNodes) {
        const n = nodeMap.get(node.id);
        if (node.childrenIds) {
          for (const childId of node.childrenIds) {
            const child = nodeMap.get(childId);
            if (child && n) n.children.push(child);
          }
        }
        
        // Check if it's a root (no parent references it)
        const hasParent = flatNodes.some((p: any) => 
          p.childrenIds?.includes(node.id)
        );
        if (!hasParent && n) roots.push(n);
      }
      
      return roots;
    }),
  };
});

// ============================================================================
// Mock fetch for AI calls
// ============================================================================

global.fetch = vi.fn(async (url, options) => {
  if (url.toString().includes("/api/v1/ai/completion")) {
    return {
      ok: true,
      json: async () => ({
        content: "Mock AI generated content for testing.",
        tokensUsed: 100,
      }),
    } as Response;
  }
  
  throw new Error(`Unhandled fetch: ${url}`);
});

// ============================================================================
// Mock window.matchMedia
// ============================================================================

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ============================================================================
// Mock IntersectionObserver
// ============================================================================

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

// ============================================================================
// Mock ResizeObserver
// ============================================================================

class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});

// ============================================================================
// Reset state between tests
// ============================================================================

beforeEach(() => {
  uuidCounter = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up any test state
});
