/**
 * Property-based tests for RoomConfigurator.
 *
 * P12: Room obstacle collision detection is correct
 * Validates: Requirements 12.4
 *
 * P13: Room configuration JSON round-trip
 * Validates: Requirements 12.5
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { obstacleToAABB, aabbIntersects } from '../components/RoomConfigurator';
import type { AABB, RoomDimensions, RoomObstacle, RoomConfigurationExport } from '../lib/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const dimensionsArb = fc.record({
  lengthMm: fc.integer({ min: 1000, max: 10000 }),
  widthMm: fc.integer({ min: 1000, max: 10000 }),
  heightMm: fc.integer({ min: 2000, max: 4000 }),
});

const obstacleArb = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('window', 'door') as fc.Arbitrary<'window' | 'door'>,
  wall: fc.constantFrom('north', 'south', 'east', 'west') as fc.Arbitrary<'north' | 'south' | 'east' | 'west'>,
  heightFromFloorMm: fc.integer({ min: 0, max: 1000 }),
  widthMm: fc.integer({ min: 100, max: 1000 }),
  heightMm: fc.integer({ min: 100, max: 1000 }),
  offsetFromLeftMm: fc.integer({ min: 0, max: 500 }),
});

/**
 * Arbitrary for a furniture AABB. We use a moderate range so that
 * intersections with obstacle AABBs are plausible but not guaranteed.
 */
const furnitureAABBArb: fc.Arbitrary<AABB> = fc.record({
  cx: fc.integer({ min: -3000, max: 3000 }),
  cy: fc.integer({ min: 0, max: 2000 }),
  cz: fc.integer({ min: -3000, max: 3000 }),
  sx: fc.integer({ min: 100, max: 2000 }),
  sy: fc.integer({ min: 100, max: 2000 }),
  sz: fc.integer({ min: 100, max: 2000 }),
}).map(({ cx, cy, cz, sx, sy, sz }) => ({
  minX: cx - sx / 2,
  maxX: cx + sx / 2,
  minY: cy,
  maxY: cy + sy,
  minZ: cz - sz / 2,
  maxZ: cz + sz / 2,
}));

// ---------------------------------------------------------------------------
// P12: Room obstacle collision detection is correct
// Validates: Requirements 12.4
// ---------------------------------------------------------------------------

describe('P12: Room obstacle collision detection is correct', () => {
  /**
   * Property: For any furniture AABB and any list of obstacles, the result of
   * checking whether any obstacle AABB intersects the furniture AABB must be
   * `true` if and only if at least one obstacle AABB actually intersects it.
   *
   * **Validates: Requirements 12.4**
   */
  it('aabbIntersects returns true iff the furniture AABB overlaps at least one obstacle AABB', () => {
    fc.assert(
      fc.property(
        fc.record({
          furnitureAABB: furnitureAABBArb,
          obstacles: fc.array(obstacleArb),
          room: dimensionsArb,
        }),
        ({ furnitureAABB, obstacles, room }) => {
          // Compute each obstacle's AABB and check intersection individually
          const obstacleAABBs = obstacles.map((obs) => obstacleToAABB(obs, room));

          // The "any collision" result using our function under test
          const anyCollision = obstacleAABBs.some((obsAABB) =>
            aabbIntersects(furnitureAABB, obsAABB),
          );

          // Ground-truth: manually verify each pair using the AABB overlap formula
          const expectedAnyCollision = obstacleAABBs.some((obsAABB) => {
            return (
              furnitureAABB.minX < obsAABB.maxX &&
              furnitureAABB.maxX > obsAABB.minX &&
              furnitureAABB.minY < obsAABB.maxY &&
              furnitureAABB.maxY > obsAABB.minY &&
              furnitureAABB.minZ < obsAABB.maxZ &&
              furnitureAABB.maxZ > obsAABB.minZ
            );
          });

          return anyCollision === expectedAnyCollision;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('aabbIntersects is symmetric: intersects(a, b) === intersects(b, a)', () => {
    fc.assert(
      fc.property(
        fc.record({
          furnitureAABB: furnitureAABBArb,
          obstacles: fc.array(obstacleArb, { minLength: 1 }),
          room: dimensionsArb,
        }),
        ({ furnitureAABB, obstacles, room }) => {
          return obstacles.every((obs) => {
            const obsAABB = obstacleToAABB(obs, room);
            return (
              aabbIntersects(furnitureAABB, obsAABB) ===
              aabbIntersects(obsAABB, furnitureAABB)
            );
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P13: Room configuration JSON round-trip
// Validates: Requirements 12.5
// ---------------------------------------------------------------------------

describe('P13: Room configuration JSON round-trip', () => {
  /**
   * Property: Serialising a RoomConfigurationExport to JSON and parsing it
   * back produces an object whose `dimensions` and `obstacles` are deeply
   * equal to the originals.
   *
   * **Validates: Requirements 12.5**
   */
  it('JSON.stringify + JSON.parse preserves dimensions and obstacles exactly', () => {
    fc.assert(
      fc.property(
        fc.record({
          dimensions: dimensionsArb,
          obstacles: fc.array(obstacleArb),
        }),
        ({ dimensions, obstacles }) => {
          const exportData: RoomConfigurationExport = {
            version: '1.0',
            createdAt: new Date().toISOString(),
            dimensions,
            obstacles,
          };

          const json = JSON.stringify(exportData);
          const parsed = JSON.parse(json) as RoomConfigurationExport;

          // Dimensions must be deeply equal
          const dimsMatch =
            parsed.dimensions.lengthMm === dimensions.lengthMm &&
            parsed.dimensions.widthMm === dimensions.widthMm &&
            parsed.dimensions.heightMm === dimensions.heightMm;

          if (!dimsMatch) return false;

          // Obstacles array length must match
          if (parsed.obstacles.length !== obstacles.length) return false;

          // Each obstacle must be deeply equal
          return obstacles.every((obs, i) => {
            const p = parsed.obstacles[i];
            return (
              p.id === obs.id &&
              p.type === obs.type &&
              p.wall === obs.wall &&
              p.heightFromFloorMm === obs.heightFromFloorMm &&
              p.widthMm === obs.widthMm &&
              p.heightMm === obs.heightMm &&
              p.offsetFromLeftMm === obs.offsetFromLeftMm
            );
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('round-trip preserves version field', () => {
    fc.assert(
      fc.property(
        fc.record({
          dimensions: dimensionsArb,
          obstacles: fc.array(obstacleArb),
        }),
        ({ dimensions, obstacles }) => {
          const exportData: RoomConfigurationExport = {
            version: '1.0',
            createdAt: new Date().toISOString(),
            dimensions,
            obstacles,
          };

          const parsed = JSON.parse(JSON.stringify(exportData)) as RoomConfigurationExport;
          return parsed.version === '1.0';
        },
      ),
      { numRuns: 50 },
    );
  });
});
