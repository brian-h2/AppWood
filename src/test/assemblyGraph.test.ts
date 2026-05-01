/**
 * Property-based tests for AssemblyGraph and registerConnection.
 *
 * P10: Snap connections are recorded in assembly graph
 * Validates: Requirements 9.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { registerConnection } from '../lib/snap/snapEngine';
import {
  createGraph,
  addNode,
  addEdge,
  removeNode,
  serialize,
  deserialize,
} from '../lib/snap/assemblyGraph';
import type { BuildingBlock, ConnectionEdge } from '../lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal BuildingBlock for testing. */
function makeBlock(id: string): BuildingBlock {
  return {
    id,
    type: 'side-panel',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 100, y: 200, z: 18 },
    rotation: { x: 0, y: 0, z: 0 },
    material: 'melamine-18',
    connections: [],
    edgeBanding: { faces: {} },
    grainDirection: 'none',
    parentId: null,
    visualValidationStatus: 'ok',
  };
}

// ---------------------------------------------------------------------------
// P10: Snap connections are recorded in assembly graph
// Validates: Requirements 9.4
// ---------------------------------------------------------------------------

describe('P10: Snap connections are recorded in assembly graph', () => {
  /**
   * **Validates: Requirements 9.4**
   *
   * Property: after registerConnection, the graph contains exactly one edge
   * with the correct fromBlockId, toBlockId, fromFace, and toFace.
   */
  it('after registerConnection, graph contains exactly one edge with correct IDs and faces', () => {
    fc.assert(
      fc.property(
        fc.record({
          idA: fc.string({ minLength: 1, maxLength: 10 }),
          idB: fc.string({ minLength: 1, maxLength: 10 }),
          faceA: fc.integer({ min: 0, max: 5 }),
          faceB: fc.integer({ min: 0, max: 5 }),
        }),
        ({ idA, idB, faceA, faceB }) => {
          // Ensure different IDs to avoid degenerate case
          if (idA === idB) return true;

          const blockA = makeBlock(idA);
          const blockB = makeBlock(idB);

          let graph = createGraph();
          graph = addNode(blockA, graph);
          graph = addNode(blockB, graph);

          const edge: ConnectionEdge = {
            fromBlockId: idA,
            toBlockId: idB,
            fromFace: faceA,
            toFace: faceB,
          };

          graph = registerConnection(edge, graph);

          // Property: exactly one edge with correct IDs and faces
          const matchingEdges = graph.edges.filter(
            (e) =>
              e.fromBlockId === idA &&
              e.toBlockId === idB &&
              e.fromFace === faceA &&
              e.toFace === faceB,
          );

          return matchingEdges.length === 1 && graph.edges.length === 1;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('calling registerConnection twice with the same edge does not create duplicates', () => {
    fc.assert(
      fc.property(
        fc.record({
          idA: fc.string({ minLength: 1, maxLength: 10 }),
          idB: fc.string({ minLength: 1, maxLength: 10 }),
          faceA: fc.integer({ min: 0, max: 5 }),
          faceB: fc.integer({ min: 0, max: 5 }),
        }),
        ({ idA, idB, faceA, faceB }) => {
          if (idA === idB) return true;

          const blockA = makeBlock(idA);
          const blockB = makeBlock(idB);

          let graph = createGraph();
          graph = addNode(blockA, graph);
          graph = addNode(blockB, graph);

          const edge: ConnectionEdge = {
            fromBlockId: idA,
            toBlockId: idB,
            fromFace: faceA,
            toFace: faceB,
          };

          // Register the same edge twice
          graph = registerConnection(edge, graph);
          graph = registerConnection(edge, graph);

          // Property: still exactly one edge (no duplicate)
          return graph.edges.length === 1;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('calling registerConnection with the reverse edge does not create duplicates', () => {
    fc.assert(
      fc.property(
        fc.record({
          idA: fc.string({ minLength: 1, maxLength: 10 }),
          idB: fc.string({ minLength: 1, maxLength: 10 }),
          faceA: fc.integer({ min: 0, max: 5 }),
          faceB: fc.integer({ min: 0, max: 5 }),
        }),
        ({ idA, idB, faceA, faceB }) => {
          if (idA === idB) return true;

          const blockA = makeBlock(idA);
          const blockB = makeBlock(idB);

          let graph = createGraph();
          graph = addNode(blockA, graph);
          graph = addNode(blockB, graph);

          const edge: ConnectionEdge = {
            fromBlockId: idA,
            toBlockId: idB,
            fromFace: faceA,
            toFace: faceB,
          };

          // Register forward, then reverse
          graph = registerConnection(edge, graph);
          graph = registerConnection(
            {
              fromBlockId: idB,
              toBlockId: idA,
              fromFace: faceB,
              toFace: faceA,
            },
            graph,
          );

          // Property: still exactly one edge (reverse is a duplicate)
          return graph.edges.length === 1;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// removeNode atomicity
// ---------------------------------------------------------------------------

describe('removeNode atomicity', () => {
  /**
   * Property: after removing a node, no edges in the graph reference that
   * node's ID (neither as fromBlockId nor as toBlockId).
   */
  it('after removeNode, no edges reference the removed node ID', () => {
    fc.assert(
      fc.property(
        fc.record({
          ids: fc.uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
            minLength: 2,
            maxLength: 5,
          }),
          removeIndex: fc.nat({ max: 4 }),
        }),
        ({ ids, removeIndex }) => {
          if (ids.length < 2) return true;

          // Build a graph with all nodes
          let graph = createGraph();
          for (const id of ids) {
            graph = addNode(makeBlock(id), graph);
          }

          // Add edges between consecutive pairs
          for (let i = 0; i < ids.length - 1; i++) {
            const edge: ConnectionEdge = {
              fromBlockId: ids[i],
              toBlockId: ids[i + 1],
              fromFace: 0,
              toFace: 1,
            };
            graph = addEdge(edge, graph);
          }

          // Remove one node (clamp index to valid range)
          const targetId = ids[removeIndex % ids.length];
          graph = removeNode(targetId, graph);

          // Property: no edge references the removed node
          const orphanEdges = graph.edges.filter(
            (e) => e.fromBlockId === targetId || e.toBlockId === targetId,
          );

          return orphanEdges.length === 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('removeNode also removes the node from the nodes map', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
          minLength: 1,
          maxLength: 5,
        }),
        (ids) => {
          let graph = createGraph();
          for (const id of ids) {
            graph = addNode(makeBlock(id), graph);
          }

          const targetId = ids[0];
          graph = removeNode(targetId, graph);

          return !graph.nodes.has(targetId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// serialize / deserialize round-trip
// ---------------------------------------------------------------------------

describe('serialize / deserialize round-trip', () => {
  /**
   * Property: serializing a graph and then deserializing it produces a graph
   * that is deeply equal to the original (same nodes and edges).
   */
  it('graph is deeply equal after serialize + deserialize', () => {
    fc.assert(
      fc.property(
        fc.record({
          ids: fc.uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
            minLength: 0,
            maxLength: 5,
          }),
          sawKerfMm: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
        }),
        ({ ids, sawKerfMm }) => {
          let graph = createGraph();
          for (const id of ids) {
            graph = addNode(makeBlock(id), graph);
          }

          // Add edges between consecutive pairs
          for (let i = 0; i < ids.length - 1; i++) {
            const edge: ConnectionEdge = {
              fromBlockId: ids[i],
              toBlockId: ids[i + 1],
              fromFace: i % 6,
              toFace: (i + 1) % 6,
            };
            graph = addEdge(edge, graph);
          }

          const payload = serialize(graph, sawKerfMm);
          const restored = deserialize(payload);

          // Check nodes: same IDs, same type, position, size, material, grainDirection, parentId
          if (restored.nodes.size !== graph.nodes.size) return false;

          for (const [id, original] of graph.nodes) {
            const restoredNode = restored.nodes.get(id);
            if (!restoredNode) return false;

            if (
              restoredNode.id !== original.id ||
              restoredNode.type !== original.type ||
              restoredNode.material !== original.material ||
              restoredNode.grainDirection !== original.grainDirection ||
              restoredNode.parentId !== original.parentId ||
              restoredNode.position.x !== original.position.x ||
              restoredNode.position.y !== original.position.y ||
              restoredNode.position.z !== original.position.z ||
              restoredNode.size.x !== original.size.x ||
              restoredNode.size.y !== original.size.y ||
              restoredNode.size.z !== original.size.z
            ) {
              return false;
            }
          }

          // Check edges: same count and same content
          if (restored.edges.length !== graph.edges.length) return false;

          for (let i = 0; i < graph.edges.length; i++) {
            const orig = graph.edges[i];
            const rest = restored.edges[i];
            if (
              rest.fromBlockId !== orig.fromBlockId ||
              rest.toBlockId !== orig.toBlockId ||
              rest.fromFace !== orig.fromFace ||
              rest.toFace !== orig.toFace
            ) {
              return false;
            }
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('deserialize fills missing fields with safe defaults', () => {
    // Unit test: verify that deserialized blocks have the expected default values
    let graph = createGraph();
    graph = addNode(makeBlock('block-1'), graph);

    const payload = serialize(graph, 3.2);
    const restored = deserialize(payload);

    const block = restored.nodes.get('block-1')!;
    expect(block.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(block.connections).toEqual([]);
    expect(block.edgeBanding).toEqual({ faces: {} });
    expect(block.visualValidationStatus).toBe('ok');
  });
});
