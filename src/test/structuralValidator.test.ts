/**
 * Property-based tests for StructuralValidator.
 *
 * P11: Structural validator alerts when span exceeds material limit
 * Validates: Requirements 10.2, 10.5
 *
 * P18: Local span validation status matches span vs. limit
 * Validates: Punto 5 — Feedback Visual Preventivo
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { validateSpanLocally } from '../lib/validation/structuralValidator';
import { MATERIAL_SPECS } from '../lib/types';
import type { BuildingBlock, MaterialType } from '../lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal BuildingBlock for testing. */
function makeBlock(
  id: string,
  pos: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
  type: BuildingBlock['type'] = 'shelf',
): BuildingBlock {
  return {
    id,
    type,
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
 * Builds a canonical test scenario for a given span:
 *   - Shelf block at (0, 0, 0) with size (span, 18, 300)
 *   - Left side-panel at x = -(span/2 + 18/2), size (18, 800, 300)
 *   - Right side-panel at x = +(span/2 + 18/2), size (18, 800, 300)
 *
 * The free span between the inner faces of the two side panels equals exactly `span`.
 */
function buildSpanScenario(span: number, material: MaterialType) {
  const panelThickness = 18;
  const shelfBlock = makeBlock(
    'shelf',
    { x: 0, y: 0, z: 0 },
    { x: span, y: panelThickness, z: 300 },
    'shelf',
  );

  const leftPanel = makeBlock(
    'left',
    { x: -(span / 2 + panelThickness / 2), y: 0, z: 0 },
    { x: panelThickness, y: 800, z: 300 },
    'side-panel',
  );

  const rightPanel = makeBlock(
    'right',
    { x: span / 2 + panelThickness / 2, y: 0, z: 0 },
    { x: panelThickness, y: 800, z: 300 },
    'side-panel',
  );

  return { shelfBlock, leftPanel, rightPanel };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const materialArb = fc.constantFrom<MaterialType>('melamine-18', 'mdf-18', 'solid-wood-20');

const blockArb = fc.record({
  x: fc.float({ min: -500, max: 500, noNaN: true }),
  y: fc.float({ min: -500, max: 500, noNaN: true }),
  z: fc.float({ min: -500, max: 500, noNaN: true }),
  sx: fc.float({ min: 10, max: 400, noNaN: true }),
  sy: fc.float({ min: 10, max: 400, noNaN: true }),
  sz: fc.float({ min: 10, max: 400, noNaN: true }),
});

// ---------------------------------------------------------------------------
// P11: Structural validator alerts when span exceeds material limit
// Validates: Requirements 10.2, 10.5
// ---------------------------------------------------------------------------

describe('P11: Structural validator alerts when span exceeds material limit', () => {
  /**
   * Property: validateSpanLocally generates a non-ok status when span exceeds
   * the material limit. Specifically:
   *   - status === 'error'   when span > maxSpanMm
   *   - status === 'warning' when maxSpanMm * 0.9 < span <= maxSpanMm
   *   - status === 'ok'      when span <= maxSpanMm * 0.9
   *
   * **Validates: Requirements 10.2, 10.5**
   *
   * Strategy: construct a scenario where the free span is exactly `span` mm
   * by placing two side-panel neighbors symmetrically around a shelf block.
   * The inner faces of the panels are exactly `span` mm apart.
   */
  it('status is error when span > maxSpanMm, warning when in warning zone, ok otherwise', () => {
    fc.assert(
      fc.property(
        fc.record({
          span: fc.nat({ max: 2000 }),
          material: materialArb,
        }),
        ({ span, material }) => {
          // span = 0 is a degenerate case: no meaningful span to evaluate
          if (span === 0) return true;

          const maxSpanMm = MATERIAL_SPECS[material].maxSpanMm;
          const warningThreshold = maxSpanMm * 0.9;
          const { shelfBlock, leftPanel, rightPanel } = buildSpanScenario(span, material);

          const result = validateSpanLocally(shelfBlock, [leftPanel, rightPanel], material);

          if (span > maxSpanMm) {
            // Must be 'error' — span exceeds the hard limit
            return result.status === 'error';
          } else if (span > warningThreshold) {
            // Must be 'warning' — span is in the warning zone (90%–100% of limit)
            return result.status === 'warning';
          } else {
            // Must be 'ok' — span is safely within limit
            return result.status === 'ok';
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P18: Local span validation status matches span vs. limit
// Validates: Punto 5 — Feedback Visual Preventivo
// ---------------------------------------------------------------------------

describe('P18: Local span validation status matches span vs. limit', () => {
  /**
   * Property: status matches the span vs. limit comparison exactly:
   *   - status === 'error'   when span > maxSpanMm
   *   - status === 'warning' when maxSpanMm * 0.9 < span <= maxSpanMm
   *   - status === 'ok'      when span <= maxSpanMm * 0.9
   * AND block.visualValidationStatus is mutated to the returned status.
   *
   * **Validates: Punto 5 — Feedback Visual Preventivo**
   *
   * Strategy: same canonical scenario as P11, but additionally verify the
   * side-effect mutation of block.visualValidationStatus.
   */
  it('status matches span vs. limit thresholds, and visualValidationStatus is updated', () => {
    fc.assert(
      fc.property(
        fc.record({
          span: fc.nat({ max: 2000 }),
          material: materialArb,
        }),
        ({ span, material }) => {
          // span = 0 is a degenerate case
          if (span === 0) return true;

          const maxSpanMm = MATERIAL_SPECS[material].maxSpanMm;
          const warningThreshold = maxSpanMm * 0.9;
          const { shelfBlock, leftPanel, rightPanel } = buildSpanScenario(span, material);

          const result = validateSpanLocally(shelfBlock, [leftPanel, rightPanel], material);

          // 1. status matches the span vs. limit thresholds
          let expectedStatus: 'ok' | 'warning' | 'error';
          if (span > maxSpanMm) {
            expectedStatus = 'error';
          } else if (span > warningThreshold) {
            expectedStatus = 'warning';
          } else {
            expectedStatus = 'ok';
          }

          if (result.status !== expectedStatus) {
            return false;
          }

          // 2. visualValidationStatus is mutated to the returned status
          if (shelfBlock.visualValidationStatus !== result.status) {
            return false;
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
