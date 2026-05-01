/**
 * Property-based tests for cutList.ts
 *
 * P14: Edge banding compensation reduces cut dimensions correctly
 * Validates: Punto 1 — Compensación de Tapacantos
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { generateCutList } from '../lib/cutList';
import { DEFAULT_NESTING_CONFIG } from '../lib/types';
import type { BuildingBlock, EdgeBandingConfig, FaceName } from '../lib/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates block sizes large enough to accommodate edge banding corrections.
 * min: 100 mm ensures there is always room for the banding thickness (max 2 mm).
 */
const blockSizeArb = fc.integer({ min: 100, max: 2000 });

/**
 * Edge banding thickness: small float values typical for PVC/ABS banding.
 * Using Math.fround to match the float precision used in the task spec.
 */
const edgeBandingThicknessArb = fc.float({
  min: Math.fround(0.1),
  max: Math.fround(2),
  noNaN: true,
});

/**
 * Generates an optional edge banding face config.
 * null means the face has no banding applied.
 */
const faceArb = fc.option(
  fc.record({
    thicknessMm: edgeBandingThicknessArb,
    material: fc.constantFrom<'pvc' | 'abs' | 'wood-veneer'>('pvc', 'abs', 'wood-veneer'),
  }),
);

/**
 * Generates a full EdgeBandingConfig with optional banding on each face.
 */
const edgeBandingArb = fc.record({
  left:   faceArb,
  right:  faceArb,
  front:  faceArb,
  back:   faceArb,
  top:    faceArb,
  bottom: faceArb,
}).map((faces) => {
  // Filter out null entries to produce a Partial<Record<FaceName, EdgeBandingFace>>
  const result: EdgeBandingConfig['faces'] = {};
  for (const [face, config] of Object.entries(faces) as [FaceName, typeof faces.left][]) {
    if (config !== null) {
      result[face] = config;
    }
  }
  return { faces: result } satisfies EdgeBandingConfig;
});

/**
 * Generates a minimal BuildingBlock with arbitrary sizes and edge banding.
 * The block is always valid: sizes are large enough that no banding thickness
 * can exceed the nominal dimension (blockSizeArb min 100 mm, banding max 2 mm).
 */
const buildingBlockArb = fc.record({
  sizeX: blockSizeArb,
  sizeY: blockSizeArb,
  sizeZ: blockSizeArb,
  edgeBanding: edgeBandingArb,
}).map(({ sizeX, sizeY, sizeZ, edgeBanding }): BuildingBlock => ({
  id: 'test-block-001',
  type: 'shelf',
  position: { x: 0, y: 0, z: 0 },
  size: { x: sizeX, y: sizeY, z: sizeZ },
  rotation: { x: 0, y: 0, z: 0 },
  material: 'melamine-18',
  connections: [],
  edgeBanding,
  grainDirection: 'none',
  parentId: null,
  visualValidationStatus: 'ok',
}));

// ---------------------------------------------------------------------------
// P14: Edge banding compensation reduces cut dimensions correctly
// Validates: Punto 1 — Compensación de Tapacantos
// ---------------------------------------------------------------------------

describe('P14: Edge banding compensation reduces cut dimensions correctly', () => {
  /**
   * **Validates: Punto 1 — Compensación de Tapacantos**
   *
   * Property: for any block with arbitrary edge banding configuration:
   *   - nominalLengthMm === block.size.x  (unchanged by banding)
   *   - nominalWidthMm  === block.size.z  (unchanged by banding)
   *   - cutLengthMm === nominalLengthMm - sum(left.thickness + right.thickness)
   *   - cutWidthMm  === nominalWidthMm  - sum(front.thickness + back.thickness)
   *
   * Face-to-dimension mapping:
   *   - 'left'  and 'right'  → affect length (block.size.x)
   *   - 'front' and 'back'   → affect width  (block.size.z)
   *   - 'top'   and 'bottom' → no effect on cut dimensions
   */
  it('cutLengthMm and cutWidthMm are reduced by the sum of corrections for each dimension', () => {
    fc.assert(
      fc.property(
        fc.record({
          block: buildingBlockArb,
        }),
        ({ block }) => {
          const cutList = generateCutList([block], DEFAULT_NESTING_CONFIG);

          // The block is always valid (sizes >> banding thickness), so it must appear
          if (cutList.length !== 1) {
            return false;
          }

          const item = cutList[0];
          const faces = block.edgeBanding.faces;

          // 1. Nominal dimensions are unchanged
          if (item.nominalLengthMm !== block.size.x) return false;
          if (item.nominalWidthMm  !== block.size.z) return false;

          // 2. Compute expected corrections
          const leftThickness  = faces.left?.thicknessMm  ?? 0;
          const rightThickness = faces.right?.thicknessMm ?? 0;
          const frontThickness = faces.front?.thicknessMm ?? 0;
          const backThickness  = faces.back?.thicknessMm  ?? 0;

          const expectedCutLength = block.size.x - (leftThickness + rightThickness);
          const expectedCutWidth  = block.size.z - (frontThickness + backThickness);

          // 3. Verify cut dimensions match expected values (allow tiny float tolerance)
          const tolerance = 0.0001;
          if (Math.abs(item.cutLengthMm - expectedCutLength) > tolerance) return false;
          if (Math.abs(item.cutWidthMm  - expectedCutWidth)  > tolerance) return false;

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('top and bottom face banding does not affect cut length or width', () => {
    fc.assert(
      fc.property(
        fc.record({
          sizeX: blockSizeArb,
          sizeY: blockSizeArb,
          sizeZ: blockSizeArb,
          topThickness:    edgeBandingThicknessArb,
          bottomThickness: edgeBandingThicknessArb,
        }),
        ({ sizeX, sizeY, sizeZ, topThickness, bottomThickness }) => {
          const block: BuildingBlock = {
            id: 'test-block-top-bottom',
            type: 'shelf',
            position: { x: 0, y: 0, z: 0 },
            size: { x: sizeX, y: sizeY, z: sizeZ },
            rotation: { x: 0, y: 0, z: 0 },
            material: 'melamine-18',
            connections: [],
            edgeBanding: {
              faces: {
                top:    { thicknessMm: topThickness,    material: 'pvc' },
                bottom: { thicknessMm: bottomThickness, material: 'pvc' },
              },
            },
            grainDirection: 'none',
            parentId: null,
            visualValidationStatus: 'ok',
          };

          const cutList = generateCutList([block], DEFAULT_NESTING_CONFIG);

          if (cutList.length !== 1) return false;

          const item = cutList[0];

          // top/bottom banding must NOT reduce cut length or width
          return (
            item.cutLengthMm === block.size.x &&
            item.cutWidthMm  === block.size.z
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('nominal dimensions are always equal to block.size.x and block.size.z', () => {
    fc.assert(
      fc.property(
        buildingBlockArb,
        (block) => {
          const cutList = generateCutList([block], DEFAULT_NESTING_CONFIG);

          if (cutList.length !== 1) return false;

          const item = cutList[0];
          return (
            item.nominalLengthMm === block.size.x &&
            item.nominalWidthMm  === block.size.z
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
