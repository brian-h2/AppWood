/**
 * SnapEngine — Building Blocks snap, AABB collision and connection registration.
 *
 * Units: millimetres (mm) throughout.
 * No Three.js dependency — all vectors are plain {x, y, z} objects.
 *
 * Face index convention:
 *   0 = +X   1 = -X
 *   2 = +Y   3 = -Y
 *   4 = +Z   5 = -Z
 */

import {
  type BuildingBlock,
  type ConnectionEdge,
  type AssemblyGraph,
  blockToAABB,
} from '../types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SnapResult {
  snapped: boolean;
  targetPosition: { x: number; y: number; z: number };
  highlightFace: number | null;
  connectionEdge: ConnectionEdge | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SNAP_THRESHOLD_MM = 20;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns the centre of a given face on a block. */
function getFaceCenter(
  block: BuildingBlock,
  face: number,
): { x: number; y: number; z: number } {
  const { position: p, size: s } = block;
  switch (face) {
    case 0: return { x: p.x + s.x / 2, y: p.y,           z: p.z           }; // +X
    case 1: return { x: p.x - s.x / 2, y: p.y,           z: p.z           }; // -X
    case 2: return { x: p.x,           y: p.y + s.y / 2, z: p.z           }; // +Y
    case 3: return { x: p.x,           y: p.y - s.y / 2, z: p.z           }; // -Y
    case 4: return { x: p.x,           y: p.y,           z: p.z + s.z / 2 }; // +Z
    case 5: return { x: p.x,           y: p.y,           z: p.z - s.z / 2 }; // -Z
    default: return { ...p };
  }
}

/** Returns the opposite face index (0↔1, 2↔3, 4↔5). */
function oppositeFace(face: number): number {
  return face % 2 === 0 ? face + 1 : face - 1;
}

/** Euclidean distance between two 3-D points. */
function distance3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ---------------------------------------------------------------------------
// computeSnap
// ---------------------------------------------------------------------------

/**
 * Detects whether `movingBlock` should snap to any block in `allBlocks`.
 *
 * For each stationary block (every block except `movingBlock` itself) the
 * function checks all 36 face-pair combinations (6 faces × 6 faces).  When
 * the minimum distance between any pair of face centres is < SNAP_THRESHOLD_MM
 * the moving block is repositioned so that its snapping face centre coincides
 * with the opposite face centre of the stationary block.
 *
 * The best snap (smallest distance) is returned when multiple candidates exist.
 */
export function computeSnap(
  movingBlock: BuildingBlock,
  allBlocks: BuildingBlock[],
): SnapResult {
  const noSnap: SnapResult = {
    snapped: false,
    targetPosition: { ...movingBlock.position },
    highlightFace: null,
    connectionEdge: null,
  };

  let bestDistance = SNAP_THRESHOLD_MM; // strictly-less-than threshold
  let bestResult: SnapResult | null = null;

  for (const stationary of allBlocks) {
    if (stationary.id === movingBlock.id) continue;

    for (let mf = 0; mf < 6; mf++) {
      const movingFaceCenter = getFaceCenter(movingBlock, mf);

      for (let sf = 0; sf < 6; sf++) {
        const stationaryFaceCenter = getFaceCenter(stationary, sf);
        const dist = distance3D(movingFaceCenter, stationaryFaceCenter);

        if (dist < bestDistance) {
          bestDistance = dist;

          // Align the moving block so its face mf coincides with the
          // opposite face of the stationary block (sf's opposite).
          const targetFaceOnStationary = oppositeFace(sf);
          const snapPoint = getFaceCenter(stationary, targetFaceOnStationary);

          // The moving block's face centre (mf) must land on snapPoint.
          // Offset from moving block centre to its face mf:
          const movingFaceOffset = {
            x: movingFaceCenter.x - movingBlock.position.x,
            y: movingFaceCenter.y - movingBlock.position.y,
            z: movingFaceCenter.z - movingBlock.position.z,
          };

          const targetPosition = {
            x: snapPoint.x - movingFaceOffset.x,
            y: snapPoint.y - movingFaceOffset.y,
            z: snapPoint.z - movingFaceOffset.z,
          };

          bestResult = {
            snapped: true,
            targetPosition,
            highlightFace: mf,
            connectionEdge: {
              fromBlockId: movingBlock.id,
              toBlockId: stationary.id,
              fromFace: mf,
              toFace: sf,
            },
          };
        }
      }
    }
  }

  return bestResult ?? noSnap;
}

// ---------------------------------------------------------------------------
// checkAABBCollision
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the intersection volume of the two blocks' AABBs is > 0.
 *
 * Intersection volume > 0 requires strictly positive overlap on all three axes.
 */
export function checkAABBCollision(
  a: BuildingBlock,
  b: BuildingBlock,
): boolean {
  const aabb_a = blockToAABB(a);
  const aabb_b = blockToAABB(b);

  const overlapX = Math.min(aabb_a.maxX, aabb_b.maxX) - Math.max(aabb_a.minX, aabb_b.minX);
  const overlapY = Math.min(aabb_a.maxY, aabb_b.maxY) - Math.max(aabb_a.minY, aabb_b.minY);
  const overlapZ = Math.min(aabb_a.maxZ, aabb_b.maxZ) - Math.max(aabb_a.minZ, aabb_b.minZ);

  return overlapX > 0 && overlapY > 0 && overlapZ > 0;
}

// ---------------------------------------------------------------------------
// registerConnection
// ---------------------------------------------------------------------------

/**
 * Adds `edge` to `graph.edges` unless an equivalent edge already exists.
 *
 * Duplicate detection considers both directions:
 *   - (fromBlockId, toBlockId, fromFace, toFace)
 *   - (toBlockId, fromBlockId, toFace, fromFace)  ← reverse
 *
 * Returns a new `AssemblyGraph` (immutable update).
 */
export function registerConnection(
  edge: ConnectionEdge,
  graph: AssemblyGraph,
): AssemblyGraph {
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
// getChildren
// ---------------------------------------------------------------------------

/**
 * Returns all blocks whose `parentId` equals `blockId`.
 *
 * Requirements: 9.1
 */
export function getChildren(
  blockId: string,
  blocks: BuildingBlock[],
): BuildingBlock[] {
  return blocks.filter((b) => b.parentId === blockId);
}

// ---------------------------------------------------------------------------
// propagateMovement
// ---------------------------------------------------------------------------

/**
 * Applies a position delta to the block identified by `parentId` AND all of
 * its descendants recursively.
 *
 * Pure function — returns a new array of blocks; the input array is never
 * mutated.
 *
 * Algorithm:
 *   1. Collect the IDs of every descendant of `parentId` via a BFS/DFS walk.
 *   2. Map over `blocks`, adding `delta` to the position of any block whose
 *      id is in the affected set (including the parent itself).
 *
 * Requirements: 9.1, 9.2
 */
export function propagateMovement(
  parentId: string,
  delta: { x: number; y: number; z: number },
  blocks: BuildingBlock[],
): BuildingBlock[] {
  // Collect all descendant IDs (including the parent) using an iterative DFS.
  const affectedIds = new Set<string>();
  const stack: string[] = [parentId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    affectedIds.add(current);
    for (const child of getChildren(current, blocks)) {
      if (!affectedIds.has(child.id)) {
        stack.push(child.id);
      }
    }
  }

  // Return a new array with updated positions for affected blocks.
  return blocks.map((block) => {
    if (!affectedIds.has(block.id)) {
      return block;
    }
    return {
      ...block,
      position: {
        x: block.position.x + delta.x,
        y: block.position.y + delta.y,
        z: block.position.z + delta.z,
      },
    };
  });
}
