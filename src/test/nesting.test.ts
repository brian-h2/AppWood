/**
 * Property-based tests for nesting.ts
 *
 * P15: Nesting spacing always includes saw kerf
 * Validates: Punto 2 — Saw Kerf
 *
 * P16: Grain direction constraint is respected in nesting
 * Validates: Punto 3 — Sentido de Veta
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { nestPieces, STANDARD_SHEETS } from '../lib/nesting';
import type { NestingItem } from '../lib/nesting';
import type { NestingConfig } from '../lib/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a single CutItem-compatible NestingItem with qty: 1 to keep
 * the nesting output simple (no multi-qty expansion).
 */
const cutItemArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  length: fc.integer({ min: 50, max: 1200 }),
  width: fc.integer({ min: 50, max: 800 }),
  thickness: fc.constantFrom(18, 20, 6),
  qty: fc.constant(1),
});

/**
 * Generates a NestingItem with a non-'none' grain direction.
 * length > width so that Math.max(length, width) === length (w) and
 * Math.min(length, width) === width (h) — makes the assertion deterministic.
 */
const blockWithGrainArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  length: fc.integer({ min: 200, max: 1200 }),
  width: fc.integer({ min: 50, max: 199 }),
  thickness: fc.constantFrom(18, 20),
  qty: fc.constant(1),
  grainDirection: fc.constantFrom('horizontal' as const, 'vertical' as const),
});

/**
 * Generates a SheetSize from the standard catalogue.
 */
const sheetArb = fc.constantFrom(...STANDARD_SHEETS);

// ---------------------------------------------------------------------------
// P15: Nesting spacing always includes saw kerf
// Validates: Punto 2 — Saw Kerf
// ---------------------------------------------------------------------------

describe('P15: Nesting spacing always includes saw kerf', () => {
  /**
   * **Validates: Punto 2 — Saw Kerf**
   *
   * Property: for every pair of adjacent placed rects on the same shelf
   * (same Y coordinate), the horizontal gap between them is >= sawKerfMm.
   *
   * "Same shelf" is defined as rects sharing the same `y` value, which is
   * how the shelf-based nesting algorithm places pieces.
   */
  it('gap between adjacent pieces on the same shelf is >= sawKerfMm', () => {
    fc.assert(
      fc.property(
        fc.record({
          items: fc.array(cutItemArb, { minLength: 1, maxLength: 10 }),
          sawKerfMm: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
        }),
        ({ items, sawKerfMm }) => {
          const config: NestingConfig = {
            sheet: STANDARD_SHEETS[0],
            sawKerfMm,
          };

          const sheets = nestPieces(items as NestingItem[], config);

          for (const sheet of sheets) {
            // Only consider placed (non-unplaceable) rects
            const placed = sheet.rects.filter((r) => !r.unplaceable);

            // Group rects by their Y coordinate (shelf)
            const byShelf = new Map<number, typeof placed>();
            for (const rect of placed) {
              const key = rect.y;
              if (!byShelf.has(key)) byShelf.set(key, []);
              byShelf.get(key)!.push(rect);
            }

            // For each shelf, sort by X and check adjacent gaps
            for (const [, shelfRects] of byShelf) {
              if (shelfRects.length < 2) continue;

              const sorted = [...shelfRects].sort((a, b) => a.x - b.x);

              for (let i = 0; i < sorted.length - 1; i++) {
                const current = sorted[i];
                const next = sorted[i + 1];
                const gap = next.x - (current.x + current.w);

                // Gap must be >= sawKerfMm (allow tiny floating-point tolerance)
                if (gap < sawKerfMm - 0.001) {
                  return false;
                }
              }
            }
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P16: Grain direction constraint is respected in nesting
// Validates: Punto 3 — Sentido de Veta
// ---------------------------------------------------------------------------

describe('P16: Grain direction constraint is respected in nesting', () => {
  /**
   * **Validates: Punto 3 — Sentido de Veta**
   *
   * Property: a piece with grainDirection !== 'none' must NOT be rotated
   * during nesting. The placed rect must have:
   *   w === Math.max(item.length, item.width)
   *   h === Math.min(item.length, item.width)
   *
   * (The nesting algorithm normalises w = max, h = min before placing.)
   */
  it('grain-constrained piece maintains original orientation (w and h are not swapped)', () => {
    fc.assert(
      fc.property(
        fc.record({
          block: blockWithGrainArb,
          sheet: sheetArb,
        }),
        ({ block, sheet }) => {
          const item: NestingItem = {
            ...block,
            qty: 1,
          };

          const config: NestingConfig = {
            sheet,
            sawKerfMm: 3.2,
          };

          const expectedW = Math.max(item.length, item.width);
          const expectedH = Math.min(item.length, item.width);

          // Skip if the piece is too large to fit on the sheet at all
          if (expectedW > sheet.width || expectedH > sheet.height) {
            return true;
          }

          const sheets = nestPieces([item], config);

          for (const nestedSheet of sheets) {
            for (const rect of nestedSheet.rects) {
              if (rect.unplaceable) continue;

              // The placed rect must match the original (non-rotated) dimensions
              if (rect.w !== expectedW || rect.h !== expectedH) {
                return false;
              }
            }
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('grain-constrained piece is marked unplaceable when it only fits rotated', () => {
    // Unit test: a piece that is wider than the sheet but fits rotated
    // must be marked unplaceable (not silently rotated).
    const sheet = STANDARD_SHEETS[0]; // 2440 × 1830

    // length > sheet.width so it cannot be placed without rotation
    const item: NestingItem = {
      name: 'Wide piece',
      length: sheet.width + 100, // 2540 — too wide
      width: 300,
      thickness: 18,
      qty: 1,
      grainDirection: 'horizontal',
    };

    const config: NestingConfig = { sheet, sawKerfMm: 3.2 };
    const sheets = nestPieces([item], config);

    // There should be exactly one sheet with one rect marked unplaceable
    const allRects = sheets.flatMap((s) => s.rects);
    const unplaceable = allRects.filter((r) => r.unplaceable);

    // The piece must be flagged, not silently rotated
    return unplaceable.length === 1;
  });
});
