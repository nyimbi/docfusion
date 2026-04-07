/**
 * HDSI Document Hooks
 * 
 * Custom hooks for managing HDSI document state and operations.
 */

export { useDocumentState, type UseDocumentStateOptions, type UseDocumentStateResult } from "./useDocumentState";
export { useContextBuffer, type UseContextBufferOptions, type UseContextBufferResult } from "./useContextBuffer";
export { 
  useDiscoveryFlow, 
  type DiscoveryStep, 
  type DiscoveryAnalysis,
  type UseDiscoveryFlowOptions, 
  type UseDiscoveryFlowResult 
} from "./useDiscoveryFlow";
export { 
  useNodeMap, 
  useNodesToGenerate, 
  useNodeStats,
  type NodeMapResult 
} from "./useNodeMap";
