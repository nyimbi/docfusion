"use client";

/**
 * Yjs Real-time Collaboration for HDSI
 * WebRTC-based peer-to-peer synchronization with presence awareness
 */

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import type { HDSINode } from "./types";
import { hdsiDB } from "./db";

// ============================================================================
// Types
// ============================================================================

export interface CollaborationSession {
  documentId: string;
  provider: WebrtcProvider;
  ydoc: Y.Doc;
  awareness: any;
  localClientId: number;
}

export interface UserPresence {
  clientId: number;
  userId: string;
  userName: string;
  userColor: string;
  cursor: {
    nodeId: string | null;
    selection: { start: number; end: number } | null;
  } | null;
  lastSeen: Date;
}

export interface CollaborationConfig {
  signalingUrls?: string[];
  password?: string;
  maxConns?: number;
  filterBcConns?: boolean;
  peerOpts?: RTCConfiguration;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_SIGNALING_URLS = [
  "wss://signaling.yjs.dev",
  "wss://y-webrtc-signaling-eu.herokuapp.com",
  "wss://y-webrtc-signaling-us.herokuapp.com",
];

const USER_COLORS = [
  "#FF5733", "#33FF57", "#3357FF", "#FF33F6", "#F6FF33",
  "#33FFF6", "#FF8033", "#8033FF", "#33FF80", "#FF3380",
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

// ============================================================================
// Collaboration Manager
// ============================================================================

export class CollaborationManager {
  private sessions = new Map<string, CollaborationSession>();
  private awarenessCallbacks = new Set<(users: UserPresence[]) => void>();
  private structureCallbacks = new Set<(structure: HDSINode[]) => void>();

  /**
   * Join a collaboration session for a document
   */
  async joinDocument(
    documentId: string,
    userId: string,
    userName: string,
    config: CollaborationConfig = {}
  ): Promise<CollaborationSession> {
    // Return existing session if already joined
    if (this.sessions.has(documentId)) {
      return this.sessions.get(documentId)!;
    }

    // Create Yjs document
    const ydoc = new Y.Doc();

    // Initialize from IndexedDB if available
    const existingDoc = await hdsiDB.getDocument(documentId);
    if (existingDoc) {
      const yStructure = ydoc.getMap("structure");
      yStructure.set("nodes", JSON.parse(JSON.stringify(existingDoc.structure)));
    }

    // Set up IndexedDB persistence for offline support
    new IndexeddbPersistence(`hdsi-${documentId}`, ydoc);

    // Create WebRTC provider for real-time sync
    const provider = new WebrtcProvider(
      `hdsi-${documentId}`,
      ydoc,
      {
        signaling: config.signalingUrls || DEFAULT_SIGNALING_URLS,
        password: config.password,
        maxConns: config.maxConns || 20,
        filterBcConns: config.filterBcConns ?? true,
        peerOpts: config.peerOpts,
      }
    );

    // Set up awareness (presence/cursors)
    const awareness = provider.awareness;
    const localClientId = awareness.clientID;

    // Set local user state
    awareness.setLocalState({
      userId,
      userName,
      userColor: getUserColor(userId),
      cursor: null,
      lastSeen: Date.now(),
    });

    // Listen for awareness changes
    awareness.on("change", () => {
      this.notifyAwarenessChange(awareness);
    });

    // Listen for structure changes
    const yStructure = ydoc.getMap("structure");
    yStructure.observe(() => {
      const nodes = yStructure.get("nodes") as HDSINode[];
      if (nodes) {
        this.notifyStructureChange(nodes);
      }
    });

    // Create session
    const session: CollaborationSession = {
      documentId,
      provider,
      ydoc,
      awareness,
      localClientId,
    };

    this.sessions.set(documentId, session);

    // Update last seen periodically
    const heartbeat = setInterval(() => {
      awareness.setLocalStateField("lastSeen", Date.now());
    }, 30000);

    // Clean up on disconnect
    provider.on("status", (event: { connected: boolean }) => {
      if (!event.connected) {
        clearInterval(heartbeat);
      }
    });

    return session;
  }

  /**
   * Leave a collaboration session
   */
  leaveDocument(documentId: string): void {
    const session = this.sessions.get(documentId);
    if (!session) return;

    // Destroy provider
    session.provider.destroy();

    // Remove session
    this.sessions.delete(documentId);
  }

  /**
   * Update local cursor position
   */
  updateCursor(
    documentId: string,
    nodeId: string | null,
    selection?: { start: number; end: number }
  ): void {
    const session = this.sessions.get(documentId);
    if (!session) return;

    session.awareness.setLocalStateField("cursor", {
      nodeId,
      selection: selection || null,
    });
  }

  /**
   * Update document structure (syncs to all peers)
   */
  updateStructure(documentId: string, structure: HDSINode[]): void {
    const session = this.sessions.get(documentId);
    if (!session) return;

    const yStructure = session.ydoc.getMap("structure");
    yStructure.set("nodes", JSON.parse(JSON.stringify(structure)));

    // Also save to IndexedDB
    hdsiDB.saveDocument(documentId, structure);
  }

  /**
   * Get current structure from Yjs
   */
  getStructure(documentId: string): HDSINode[] | null {
    const session = this.sessions.get(documentId);
    if (!session) return null;

    const yStructure = session.ydoc.getMap("structure");
    return yStructure.get("nodes") as HDSINode[] || null;
  }

  /**
   * Get all connected users
   */
  getConnectedUsers(documentId: string): UserPresence[] {
    const session = this.sessions.get(documentId);
    if (!session) return [];

    const entries = Array.from(session.awareness.getStates().entries()) as [number, any][];
    const now = Date.now();

    return entries
      .filter(([, state]) => state && state.userId)
      .map(([clientId, state]) => ({
        clientId,
        userId: state.userId,
        userName: state.userName,
        userColor: state.userColor,
        cursor: state.cursor,
        lastSeen: new Date(state.lastSeen || now),
      }));
  }

  /**
   * Subscribe to awareness changes
   */
  onAwarenessChange(callback: (users: UserPresence[]) => void): () => void {
    this.awarenessCallbacks.add(callback);
    return () => this.awarenessCallbacks.delete(callback);
  }

  /**
   * Subscribe to structure changes from remote
   */
  onStructureChange(callback: (structure: HDSINode[]) => void): () => void {
    this.structureCallbacks.add(callback);
    return () => this.structureCallbacks.delete(callback);
  }

  /**
   * Check if connected to a document
   */
  isConnected(documentId: string): boolean {
    const session = this.sessions.get(documentId);
    return session?.provider.connected || false;
  }

  /**
   * Get connection status
   */
  getStatus(documentId: string): "connected" | "disconnected" | "connecting" {
    const session = this.sessions.get(documentId);
    if (!session) return "disconnected";
    if (session.provider.connected) return "connected";
    return "connecting";
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private notifyAwarenessChange(awareness: any): void {
    const entries = Array.from(awareness.getStates().entries()) as [number, any][];
    const now = Date.now();

    const users: UserPresence[] = entries
      .filter(([, state]) => state && state.userId)
      .map(([clientId, state]) => ({
        clientId,
        userId: state.userId,
        userName: state.userName,
        userColor: state.userColor,
        cursor: state.cursor,
        lastSeen: new Date(state.lastSeen || now),
      }));

    this.awarenessCallbacks.forEach(cb => cb(users));
  }

  private notifyStructureChange(structure: HDSINode[]): void {
    this.structureCallbacks.forEach(cb => cb(structure));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const collaborationManager = new CollaborationManager();

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect, useCallback } from "react";

export function useCollaboration(
  documentId: string | undefined,
  userId: string,
  userName: string
) {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [remoteStructure, setRemoteStructure] = useState<HDSINode[] | null>(null);

  useEffect(() => {
    if (!documentId) return;

    // Join document
    collaborationManager.joinDocument(documentId, userId, userName);

    // Subscribe to changes
    const unsubscribeAwareness = collaborationManager.onAwarenessChange(setUsers);
    const unsubscribeStructure = collaborationManager.onStructureChange(setRemoteStructure);

    // Check connection status
    const checkStatus = setInterval(() => {
      const status = collaborationManager.getStatus(documentId);
      setConnected(status === "connected");
    }, 1000);

    return () => {
      unsubscribeAwareness();
      unsubscribeStructure();
      clearInterval(checkStatus);
      collaborationManager.leaveDocument(documentId);
    };
  }, [documentId, userId, userName]);

  const updateCursor = useCallback((nodeId: string | null, selection?: { start: number; end: number }) => {
    if (!documentId) return;
    collaborationManager.updateCursor(documentId, nodeId, selection);
  }, [documentId]);

  const updateStructure = useCallback((structure: HDSINode[]) => {
    if (!documentId) return;
    collaborationManager.updateStructure(documentId, structure);
  }, [documentId]);

  return {
    connected,
    users,
    remoteStructure,
    updateCursor,
    updateStructure,
  };
}
