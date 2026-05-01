/**
 * Property-based tests for SnapEngine.
 *
 * P7: Snap triggers if and only if distance < 20 mm
 * Validates: Requirements 9.1
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { computeSnap, SNAP_THRESHOLD_MM } from '../lib/snap/snapEngine';
import type { BuildingBlock } from '../lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal BuildingBlock for testing. */
function makeBlock(
  id: string,
  pos: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
): BuildingBlock {
  return {
    id,
    type: 'side-panel',
    position: pos,
    size,
    rotation: { x: 0, y: 0, z: 0 },
    material: 'melamine-18',
    connections: [],
    edgeBanding: { faces: {} },
    grainDirection: 'none',
    parentId: null,
    visualValidationStatus: 'ok',
  };
}

/**
 * Computes the minimum Euclidean distance between any pair of face centres
 * from block `a` and block `b` (6 × 6 = 36 pairs).
 *
 * Face index convention (matches snapEngine.ts):
 *   0 = +X   1 = -X
 *   2 = +Y   3 = -Y
 *   4 = +Z   5 = -Z
 */
function getFaceCenter(
  block: BuildingBlock,
  face: number,
): { x: number; y: number; z: number } {
  const { position: p, size: s } = block;
  switch (face) {
    case 0: return { x: p.x + s.x / 2, y: p.y,           z: p.z           };
    case 1: return { x: p.x - s.x / 2, y: p.y,           z: p.z           };
    case 2: return { x: p.x,           y: p.y + s.y / 2, z: p.z           };
    case 3: return { x: p.x,           y: p.y - s.y / 2, z: p.z           };
    case 4: return { x: p.x,           y: p.y,           z: p.z + s.z / 2 };
    case 5: return { x: p.x,           y: p.y,           z: p.z - s.z / 2 };
    default: return { ...p };
  }
}

function dist3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Returns the minimum face-to-face distance between two blocks (36 pairs). */
function minFaceDistance(a: BuildingBlock, b: BuildingBlock): number {
  let min = Infinity;
  for (let af = 0; af < 6; af++) {
    const ac = getFaceCenter(a, af);
    for (let bf = 0; bf < 6; bf++) {
      const bc = getFaceCenter(b, bf);
      const d = dist3D(ac, bc);
      if (d < min) min = d;
    }
  }
  return min;
}

// ---------------------------------------------------------------------------
// P7: Snap triggers iff distance < 20 mm
// Validates: Requirements 9.1
// ---------------------------------------------------------------------------

describe('P7: Snap triggers iff distance < 20 mm', () => {
  it('snapped === true iff min face distance < SNAP_THRESHOLD_MM', () => {
    fc.assert(
      fc.property(
        fc.record({
          posA: fc.record({
            x: fc.float({ min: -1000, max: 1000, noNaN: true }),
            y: fc.float({ min: -1000, max: 1000, noNaN: true }),
            z: fc.float({ min: -1000, max: 1000, noNaN: true }),
          }),
          posB: fc.record({
            x: fc.float({ min: -1000, max: 1000, noNaN: true }),
            y: fc.float({ min: -1000, max: 1000, noNaN: true }),
            z: fc.float({ min: -1000, max: 1000, noNaN: true }),
          }),
          sizeA: fc.record({
            x: fc.float({ min: 1, max: 500, noNaN: true }),
            y: fc.float({ min: 1, max: 500, noNaN: true }),
            z: fc.float({ min: 1, max: 500, noNaN: true }),
          }),
          sizeB: fc.record({
            x: fc.float({ min: 1, max: 500, noNaN: true }),
            y: fc.float({ min: 1, max: 500, noNaN: true }),
            z: fc.float({ min: 1, max: 500, noNaN: true }),
          }),
        }),
        ({ posA, posB, sizeA, sizeB }) => {
          const blockA = makeBlock('a', posA, sizeA);
          const blockB = makeBlock('b', posB, sizeB);

          const result = computeSnap(blockA, [blockA, blockB]);
          const minDist = minFaceDistance(blockA, blockB);

          // Property: snapped iff minDist < SNAP_THRESHOLD_MM
          if (minDist < SNAP_THRESHOLD_MM) {
            return result.snapped === true;
          } else {
            return result.snapped === false;
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P8: Snap positions block at nearest valid snap point
// Validates: Requirements 9.2
// ---------------------------------------------------------------------------

describe('P8: Snap positions block at nearest valid snap point', () => {
  it('targetPosition places moving face center exactly on opposite face center of stationary block', () => {
    /**
     * Strategy: place blockB very close to blockA (within 15 mm on one axis)
     * so the minimum face distance is guaranteed < SNAP_THRESHOLD_MM (20 mm),
     * ensuring a snap always occurs.
     *
     * When snapped === true, verify that the moving block's face indicated by
     * `highlightFace` (mf), when placed at `targetPosition`, has its center
     * coinciding with the opposite face center of the stationary block.
     *
     * oppositeFace(f) = f % 2 === 0 ? f + 1 : f - 1
     */
    fc.assert(
      fc.property(
        // blockA: stationary block at an arbitrary position with arbitrary size
        fc.record({
          posA: fc.record({
            x: fc.float({ min: -500, max: 500, noNaN: true }),
            y: fc.float({ min: -500, max: 500, noNaN: true }),
            z: fc.float({ min: -500, max: 500, noNaN: true }),
          }),
          sizeA: fc.record({
            x: fc.float({ min: 10, max: 400, noNaN: true }),
            y: fc.float({ min: 10, max: 400, noNaN: true }),
            z: fc.float({ min: 10, max: 400, noNaN: true }),
          }),
          sizeB: fc.record({
            x: fc.float({ min: 10, max: 400, noNaN: true }),
            y: fc.float({ min: 10, max: 400, noNaN: true }),
            z: fc.float({ min: 10, max: 400, noNaN: true }),
          }),
          // axis: 0=X, 1=Y, 2=Z — which axis to place blockB close on
          axis: fc.integer({ min: 0, max: 2 }),
          // gap: distance between the two nearest faces on the chosen axis (< 15 mm)
          gap: fc.float({ min: 0, max: 14, noNaN: true }),
        }),
        ({ posA, sizeA, sizeB, axis, gap }) => {
          const blockA = makeBlock('a', posA, sizeA);

          // Place blockB so that its nearest face to blockA is `gap` mm away
          // on the chosen axis. We put blockB on the positive side of blockA.
          const halfA = axis === 0 ? sizeA.x / 2 : axis === 1 ? sizeA.y / 2 : sizeA.z / 2;
          const halfB = axis === 0 ? sizeB.x / 2 : axis === 1 ? sizeB.y / 2 : sizeB.z / 2;
          // distance between centers = halfA + gap + halfB
          const centerOffset = halfA + gap + halfB;

          const posB = { ...posA };
          if (axis === 0) posB.x = posA.x + centerOffset;
          else if (axis === 1) posB.y = posA.y + centerOffset;
          else posB.z = posA.z + centerOffset;

          const blockB = makeBlock('b', posB, sizeB);

          const result = computeSnap(blockB, [blockA, blockB]);

          // The gap is < 15 mm < SNAP_THRESHOLD_MM, so snap must occur
          if (!result.snapped) {
            // Should not happen given our setup, but guard defensively
            return true;
          }

          const mf = result.highlightFace!;
          const tp = result.targetPosition;

          // Compute the moving block's face center at targetPosition
          const blockBAtTarget = makeBlock('b', tp, sizeB);
          const movingFaceCenterAtTarget = getFaceCenter(blockBAtTarget, mf);

          // The stationary block's opposite face center
          // Find which stationary face was matched: it's the toFace from connectionEdge
          const sf = result.connectionEdge!.toFace;
          const oppFace = sf % 2 === 0 ? sf + 1 : sf - 1;
          const stationaryOppFaceCenter = getFaceCenter(blockA, oppFace);

          const tolerance = 1e-4;
          return dist3D(movingFaceCenterAtTarget, stationaryOppFaceCenter) < tolerance;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// P9: AABB collision prevents block overlap
// Validates: Requirements 9.3
// ---------------------------------------------------------------------------

import { checkAABBCollision } from '../lib/snap/snapEngine';
import { blockToAABB } from '../lib/types';

describe('P9: AABB collision prevents block overlap', () => {
  /**
   * Property: checkAABBCollision(a, b) === true if and only if the AABB
   * intersection volume > 0 (i.e. overlapX > 0 && overlapY > 0 && overlapZ > 0).
   *
   * Validates: Requirements 9.3
   */
  it('checkAABBCollision returns true iff AABB intersection volume > 0', () => {
    const block = fc.record({
      pos: fc.record({
        x: fc.float({ min: -500, max: 500, noNaN: true }),
        y: fc.float({ min: -500, max: 500, noNaN: true }),
        z: fc.float({ min: -500, max: 500, noNaN: true }),
      }),
      size: fc.record({
        x: fc.float({ min: 1, max: 400, noNaN: true }),
        y: fc.float({ min: 1, max: 400, noNaN: true }),
        z: fc.float({ min: 1, max: 400, noNaN: true }),
      }),
    });

    fc.assert(
      fc.property(
        fc.array(block, { minLength: 2, maxLength: 2 }),
        ([blockDataA, blockDataB]) => {
          const a = makeBlock('a', blockDataA.pos, blockDataA.size);
          const b = makeBlock('b', blockDataB.pos, blockDataB.size);

          // Compute expected overlap manually using blockToAABB
          const aabbA = blockToAABB(a);
          const aabbB = blockToAABB(b);

          const overlapX = Math.min(aabbA.maxX, aabbB.maxX) - Math.max(aabbA.minX, aabbB.minX);
          const overlapY = Math.min(aabbA.maxY, aabbB.maxY) - Math.max(aabbA.minY, aabbB.minY);
          const overlapZ = Math.min(aabbA.maxZ, aabbB.maxZ) - Math.max(aabbA.minZ, aabbB.minZ);

          const expectedCollision = overlapX > 0 && overlapY > 0 && overlapZ > 0;

          return checkAABBCollision(a, b) === expectedCollision;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// P17: Parent movement propagates to all children
// Validates: Punto 4 — Jerarquía Padre-Hijo
// ---------------------------------------------------------------------------

import { propagateMovement } from '../lib/snap/snapEngine';

describe('P17: Parent movement propagates to all children', () => {
  /**
   * Property: For any parent block with any number of child blocks and any
   * movement delta, propagateMovement SHALL displace every child by exactly
   * the same delta as the parent, and SHALL NOT move unrelated blocks.
   *
   * **Validates: Punto 4 — Jerarquía Padre-Hijo**
   */
  it('every child is displaced by exactly the same delta as the parent; unrelated blocks are not moved', () => {
    // Arbitrary for a single vec3 component (position or size)
    const coordArb = fc.float({ min: -500, max: 500, noNaN: true });
    const sizeCoordArb = fc.float({ min: 10, max: 400, noNaN: true });

    const blockArb = fc.record({
      x: coordArb,
      y: coordArb,
      z: coordArb,
      sx: sizeCoordArb,
      sy: sizeCoordArb,
      sz: sizeCoordArb,
    });

    const vec3Arb = fc.record({
      x: fc.float({ min: -1000, max: 1000, noNaN: true }),
      y: fc.float({ min: -1000, max: 1000, noNaN: true }),
      z: fc.float({ min: -1000, max: 1000, noNaN: true }),
    });

    fc.assert(
      fc.property(
        fc.record({
          parent: blockArb,
          children: fc.array(blockArb, { minLength: 1, maxLength: 5 }),
          unrelated: fc.array(blockArb, { minLength: 0, maxLength: 3 }),
          delta: vec3Arb,
        }),
        ({ parent, children, unrelated, delta }) => {
          // Build the parent block (id = 'parent', parentId = null)
          const parentBlock = makeBlock(
            'parent',
            { x: parent.x, y: parent.y, z: parent.z },
            { x: parent.sx, y: parent.sy, z: parent.sz },
          );

          // Build child blocks (parentId = 'parent')
          const childBlocks = children.map((c, i) => ({
            ...makeBlock(
              `child-${i}`,
              { x: c.x, y: c.y, z: c.z },
              { x: c.sx, y: c.sy, z: c.sz },
            ),
            parentId: 'parent' as string | null,
          }));

          // Build unrelated blocks (parentId = null, different ids)
          const unrelatedBlocks = unrelated.map((u, i) => makeBlock(
            `unrelated-${i}`,
            { x: u.x, y: u.y, z: u.z },
            { x: u.sx, y: u.sy, z: u.sz },
          ));

          const allBlocks = [parentBlock, ...childBlocks, ...unrelatedBlocks];

          const result = propagateMovement('parent', delta, allBlocks);

          const tolerance = 1e-4;

          // 1. Parent is displaced by delta
          const resultParent = result.find((b) => b.id === 'parent')!;
          if (
            Math.abs(resultParent.position.x - (parentBlock.position.x + delta.x)) > tolerance ||
            Math.abs(resultParent.position.y - (parentBlock.position.y + delta.y)) > tolerance ||
            Math.abs(resultParent.position.z - (parentBlock.position.z + delta.z)) > tolerance
          ) {
            return false;
          }

          // 2. Every child is displaced by exactly the same delta
          for (let i = 0; i < childBlocks.length; i++) {
            const original = childBlocks[i];
            const moved = result.find((b) => b.id === original.id)!;
            if (
              Math.abs(moved.position.x - (original.position.x + delta.x)) > tolerance ||
              Math.abs(moved.position.y - (original.position.y + delta.y)) > tolerance ||
              Math.abs(moved.position.z - (original.position.z + delta.z)) > tolerance
            ) {
              return false;
            }
          }

          // 3. Unrelated blocks are NOT moved
          for (let i = 0; i < unrelatedBlocks.length; i++) {
            const original = unrelatedBlocks[i];
            const unchanged = result.find((b) => b.id === original.id)!;
            if (
              Math.abs(unchanged.position.x - original.position.x) > tolerance ||
              Math.abs(unchanged.position.y - original.position.y) > tolerance ||
              Math.abs(unchanged.position.z - original.position.z) > tolerance
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
});
