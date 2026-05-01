/**
 * AssemblyGraph — immutable operations for the furniture assembly graph.
 *
 * All functions are pure: they return new graph instances and never mutate
 * their inputs.
 *
 * Units: millimetres (mm) throughout.
 * No Three.js dependency.
 */

import type {
  AssemblyGraph,
  AssemblyGraphPayload,
  BuildingBlock,
  ConnectionEdge,
} from '../types';

// ---------------------------------------------------------------------------
// createGraph
// ---------------------------------------------------------------------------

/**
 * Creates an empty AssemblyGraph with no nodes or edges.
 */
export function createGraph(): AssemblyGraph {
  return {
    nodes: new Map<string, BuildingBlock>(),
    edges: [],
  };
}

// ---------------------------------------------------------------------------
// addNode
// ---------------------------------------------------------------------------

/**
 * Adds a BuildingBlock to the graph.
 * Returns a new AssemblyGraph (immutable update).
 * If a node with the same id already exists it is replaced.
 */
export function addNode(block: BuildingBlock, graph: AssemblyGraph): AssemblyGraph {
  const nodes = new Map(graph.nodes);
  nodes.set(block.id, block);
  return {
    ...graph,
    nodes,
  };
}

// ---------------------------------------------------------------------------
// removeNode
// ---------------------------------------------------------------------------

/**
 * ATOMIC removal: removes the node with the given id from the nodes Map AND
 * filters out every ConnectionEdge that references that id (as fromBlockId or
 * toBlockId) in a single operation.
 *
 * Returns a new AssemblyGraph (immutable update).
 * If the id does not exist the original graph is returned unchanged.
 */
export function removeNode(id: string, graph: AssemblyGraph): AssemblyGraph {
  if (!graph.nodes.has(id)) {
    return graph;
  }

  const nodes = new Map(graph.nodes);
  nodes.delete(id);

  const edges = graph.edges.filter(
    (e) => e.fromBlockId !== id && e.toBlockId !== id,
  );

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// addEdge
// ---------------------------------------------------------------------------

/**
 * Adds a ConnectionEdge to the graph, preventing duplicates.
 *
 * Duplicate detection considers both directions:
 *   - (fromBlockId, toBlockId, fromFace, toFace)
 *   - (toBlockId, fromBlockId, toFace, fromFace)  ← reverse
 *
 * Returns a new AssemblyGraph (immutable update).
 */
export function addEdge(edge: ConnectionEdge, graph: AssemblyGraph): AssemblyGraph {
  const isDuplicate = graph.edges.some(
    (e) =>
      (e.fromBlockId === edge.fromBlockId &&
        e.toBlockId === edge.toBlockId &&
        e.fromFace === edge.fromFace &&
        e.toFace === edge.toFace) ||
      (e.fromBlockId === edge.toBlockId &&
        e.toBlockId === edge.fromBlockId &&
        e.fromFace === edge.toFace &&
        e.toFace === edge.fromFace),
  );

  if (isDuplicate) {
    return graph;
  }

  return {
    ...graph,
    edges: [...graph.edges, edge],
  };
}

// ---------------------------------------------------------------------------
// removeEdge
// ---------------------------------------------------------------------------

/**
 * Removes a ConnectionEdge identified by (fromBlockId, toBlockId, fromFace,
 * toFace).  Both the forward and reverse directions are matched so callers
 * do not need to know the canonical direction.
 *
 * Returns a new AssemblyGraph (immutable update).
 */
export function removeEdge(edge: ConnectionEdge, graph: AssemblyGraph): AssemblyGraph {
  const edges = graph.edges.filter(
    (e) =>
      !(
        (e.fromBlockId === edge.fromBlockId &&
          e.toBlockId === edge.toBlockId &&
          e.fromFace === edge.fromFace &&
          e.toFace === edge.toFace) ||
        (e.fromBlockId === edge.toBlockId &&
          e.toBlockId === edge.fromBlockId &&
          e.fromFace === edge.toFace &&
          e.toFace === edge.fromFace)
      ),
  );

  return { ...graph, edges };
}

// ---------------------------------------------------------------------------
// serialize
// ---------------------------------------------------------------------------

/**
 * Serialises an AssemblyGraph to an AssemblyGraphPayload suitable for JSON
 * transport (e.g. Lambda invocations).
 *
 * The Map of nodes is converted to a plain array containing only the fields
 * required by the payload schema.  The `sawKerfMm` value comes from the
 * active NestingConfig and must be supplied by the caller.
 */
export function serialize(graph: AssemblyGraph, sawKerfMm: number): AssemblyGraphPayload {
  const nodes: AssemblyGraphPayload['nodes'] = [];

  for (const block of graph.nodes.values()) {
    nodes.push({
      id: block.id,
      type: block.type,
      position: { ...block.position },
      size: { ...block.size },
      material: block.material,
      grainDirection: block.grainDirection,
      parentId: block.parentId,
    });
  }

  return {
    nodes,
    edges: graph.edges.map((e) => ({ ...e })),
    sawKerfMm,
  };
}

// ---------------------------------------------------------------------------
// deserialize
// ---------------------------------------------------------------------------

/**
 * Reconstructs an AssemblyGraph from an AssemblyGraphPayload.
 *
 * Fields not present in the payload are filled with safe defaults:
 *   - rotation:               { x: 0, y: 0, z: 0 }
 *   - connections:            []
 *   - edgeBanding:            { faces: {} }
 *   - visualValidationStatus: 'ok'
 */
export function deserialize(payload: AssemblyGraphPayload): AssemblyGraph {
  const nodes = new Map<string, BuildingBlock>();

  for (const n of payload.nodes) {
    const block: BuildingBlock = {
      id: n.id,
      type: n.type,
      position: { ...n.position },
      size: { ...n.size },
      material: n.material,
      grainDirection: n.grainDirection,
      parentId: n.parentId,
      // Defaults for fields not present in the payload
      rotation: { x: 0, y: 0, z: 0 },
      connections: [],
      edgeBanding: { faces: {} },
      visualValidationStatus: 'ok',
    };
    nodes.set(block.id, block);
  }

  return {
    nodes,
    edges: payload.edges.map((e) => ({ ...e })),
  };
}
