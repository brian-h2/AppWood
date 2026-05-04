/**
 * Tests for src/lib/doors.ts
 *
 * Covers:
 *   - calcDoorSize: overlay single, overlay double, inset single, inset double, none
 *   - validateDoor: ok, warning (aspect ratio), error (too wide), error (degenerate)
 *   - computeDoorBlocks: count, pivot sides, positions, edge banding, type
 */

import { describe, it, expect } from 'vitest';
import { calcDoorSize, validateDoor, computeDoorBlocks, computeDoorBlocksParametric } from '../lib/doors';
import type { DoorConfig } from '../lib/types';
import { MATERIAL_SPECS } from '../lib/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const W = 800;
const H = 600;
const D = 300;
const T = MATERIAL_SPECS['melamine-18'].thickness; // 18

const baseConfig: DoorConfig = {
  type: 'none',
  swing: 'left',
  mount: 'overlay',
  hardwareStyle: 'barral',
  hardwarePosition: 'center',
};

// ---------------------------------------------------------------------------
// calcDoorSize
// ---------------------------------------------------------------------------

describe('calcDoorSize', () => {
  it('returns null when type is none', () => {
    expect(calcDoorSize(W, H, T, { ...baseConfig, type: 'none' })).toBeNull();
  });

  it('overlay single: Wp = W - 4, Hp = H - 4', () => {
    const result = calcDoorSize(W, H, T, { ...baseConfig, type: 'single', mount: 'overlay' });
    expect(result).not.toBeNull();
    expect(result!.Wp).toBe(W - 4);
    expect(result!.Hp).toBe(H - 4);
    expect(result!.count).toBe(1);
  });

  it('overlay double: Wp = W/2 - 2, Hp = H - 4', () => {
    const result = calcDoorSize(W, H, T, { ...baseConfig, type: 'double', mount: 'overlay' });
    expect(result).not.toBeNull();
    expect(result!.Wp).toBe(W / 2 - 2);
    expect(result!.Hp).toBe(H - 4);
    expect(result!.count).toBe(2);
  });

  it('inset single: Wp = W - 2T - 4, Hp = H - 2T - 4', () => {
    const result = calcDoorSize(W, H, T, { ...baseConfig, type: 'single', mount: 'inset' });
    expect(result).not.toBeNull();
    expect(result!.Wp).toBe(W - 2 * T - 4);
    expect(result!.Hp).toBe(H - 2 * T - 4);
    expect(result!.count).toBe(1);
  });

  it('inset double: Wp = (W - 2T)/2 - 2, Hp = H - 2T - 4', () => {
    const result = calcDoorSize(W, H, T, { ...baseConfig, type: 'double', mount: 'inset' });
    expect(result).not.toBeNull();
    expect(result!.Wp).toBe((W - 2 * T) / 2 - 2);
    expect(result!.Hp).toBe(H - 2 * T - 4);
    expect(result!.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// validateDoor
// ---------------------------------------------------------------------------

describe('validateDoor', () => {
  it('returns ok for normal proportions', () => {
    const size = { Wp: 400, Hp: 800, count: 1 };
    const result = validateDoor(size, 'melamine-18');
    expect(result.status).toBe('ok');
    expect(result.message).toBeNull();
  });

  it('returns warning when Wp/Hp > 0.65', () => {
    // Wp/Hp = 700/800 = 0.875 > 0.65
    const size = { Wp: 700, Hp: 800, count: 1 };
    const result = validateDoor(size, 'melamine-18');
    expect(result.status).toBe('warning');
    expect(result.message).toContain('bisagras');
  });

  it('returns error when Wp > maxSpanMm', () => {
    // melamine-18 maxSpanMm = 800; use 900
    const size = { Wp: 900, Hp: 2000, count: 1 };
    const result = validateDoor(size, 'melamine-18');
    expect(result.status).toBe('error');
    expect(result.message).toContain('vano máximo');
  });

  it('returns error for degenerate dimensions', () => {
    const size = { Wp: 0, Hp: 600, count: 1 };
    const result = validateDoor(size, 'melamine-18');
    expect(result.status).toBe('error');
  });

  it('solid-wood-20 has higher maxSpanMm (1000)', () => {
    // 900 mm is ok for solid wood but error for melamine
    const size = { Wp: 900, Hp: 2000, count: 1 };
    expect(validateDoor(size, 'solid-wood-20').status).toBe('ok');
    expect(validateDoor(size, 'melamine-18').status).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// computeDoorBlocks
// ---------------------------------------------------------------------------

describe('computeDoorBlocks', () => {
  it('returns empty array when type is none', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'none' }, 'melamine-18', 'test');
    expect(blocks).toHaveLength(0);
  });

  it('single overlay: 1 block, type door, isDoor true', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'single', mount: 'overlay' }, 'melamine-18', 'test');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('door');
    expect(blocks[0].isDoor).toBe(true);
  });

  it('double overlay: 2 blocks with correct pivot sides', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'double', mount: 'overlay' }, 'melamine-18', 'test');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].pivotSide).toBe('left');
    expect(blocks[1].pivotSide).toBe('right');
  });

  it('single right-swing: pivot is right', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'single', swing: 'right' }, 'melamine-18', 'test');
    expect(blocks[0].pivotSide).toBe('right');
  });

  it('single left-swing: pivot is left', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'single', swing: 'left' }, 'melamine-18', 'test');
    expect(blocks[0].pivotSide).toBe('left');
  });

  it('overlay door Z position is D + T/2', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'single', mount: 'overlay' }, 'melamine-18', 'test');
    expect(blocks[0].position.z).toBe(D + T / 2);
  });

  it('inset door Z position is D - T/2', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'single', mount: 'inset' }, 'melamine-18', 'test');
    expect(blocks[0].position.z).toBe(D - T / 2);
  });

  it('door has all four edge banding faces', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'single' }, 'melamine-18', 'test');
    const faces = blocks[0].edgeBanding.faces;
    expect(faces.top).toBeDefined();
    expect(faces.bottom).toBeDefined();
    expect(faces.left).toBeDefined();
    expect(faces.right).toBeDefined();
  });

  it('door Y centre is H/2', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'single' }, 'melamine-18', 'test');
    expect(blocks[0].position.y).toBe(H / 2);
  });

  it('door size matches calcDoorSize output', () => {
    const config: DoorConfig = { ...baseConfig, type: 'double', mount: 'overlay' };
    const blocks = computeDoorBlocks(W, H, D, config, 'melamine-18', 'test');
    const expected = calcDoorSize(W, H, T, config)!;
    expect(blocks[0].size.x).toBe(expected.Wp);
    expect(blocks[0].size.y).toBe(expected.Hp);
    expect(blocks[0].size.z).toBe(T);
  });

  it('door grainDirection is vertical', () => {
    const blocks = computeDoorBlocks(W, H, D, { ...baseConfig, type: 'single' }, 'melamine-18', 'test');
    expect(blocks[0].grainDirection).toBe('vertical');
  });
});

// ---------------------------------------------------------------------------
// computeDoorBlocksParametric — centred coordinate system
// ---------------------------------------------------------------------------

describe('computeDoorBlocksParametric', () => {
  it('returns empty array when type is none', () => {
    const blocks = computeDoorBlocksParametric(W, H, D, { ...baseConfig, type: 'none' }, 'melamine-18');
    expect(blocks).toHaveLength(0);
  });

  it('single door: X centre is 0 (cabinet centre)', () => {
    const blocks = computeDoorBlocksParametric(W, H, D, { ...baseConfig, type: 'single' }, 'melamine-18');
    expect(blocks[0].position.x).toBe(0);
  });

  it('single door: Y centre is 0 (cabinet vertical centre)', () => {
    const blocks = computeDoorBlocksParametric(W, H, D, { ...baseConfig, type: 'single' }, 'melamine-18');
    expect(blocks[0].position.y).toBe(0);
  });

  it('overlay single: Z = D/2 + T/2 (in front of cabinet front face)', () => {
    const blocks = computeDoorBlocksParametric(W, H, D, { ...baseConfig, type: 'single', mount: 'overlay' }, 'melamine-18');
    expect(blocks[0].position.z).toBe(D / 2 + T / 2);
  });

  it('inset single: Z = D/2 - T/2 (flush with cabinet front face)', () => {
    const blocks = computeDoorBlocksParametric(W, H, D, { ...baseConfig, type: 'single', mount: 'inset' }, 'melamine-18');
    expect(blocks[0].position.z).toBe(D / 2 - T / 2);
  });

  it('double doors: left at -W/4, right at +W/4', () => {
    const blocks = computeDoorBlocksParametric(W, H, D, { ...baseConfig, type: 'double' }, 'melamine-18');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].position.x).toBe(-W / 4);
    expect(blocks[1].position.x).toBe(W / 4);
  });

  it('double doors: left pivot is left, right pivot is right', () => {
    const blocks = computeDoorBlocksParametric(W, H, D, { ...baseConfig, type: 'double' }, 'melamine-18');
    expect(blocks[0].pivotSide).toBe('left');
    expect(blocks[1].pivotSide).toBe('right');
  });

  it('door size matches calcDoorSize output', () => {
    const config: DoorConfig = { ...baseConfig, type: 'single', mount: 'overlay' };
    const blocks = computeDoorBlocksParametric(W, H, D, config, 'melamine-18');
    const expected = calcDoorSize(W, H, T, config)!;
    expect(blocks[0].size.x).toBe(expected.Wp);
    expect(blocks[0].size.y).toBe(expected.Hp);
    expect(blocks[0].size.z).toBe(T);
  });

  it('parametric coords differ from BB coords for same cabinet', () => {
    const config: DoorConfig = { ...baseConfig, type: 'single', mount: 'overlay' };
    const bbBlocks = computeDoorBlocks(W, H, D, config, 'melamine-18', 'test');
    const paramBlocks = computeDoorBlocksParametric(W, H, D, config, 'melamine-18');
    // BB: X = W/2 = 400, Param: X = 0
    expect(bbBlocks[0].position.x).toBe(W / 2);
    expect(paramBlocks[0].position.x).toBe(0);
    // BB: Y = H/2 = 300, Param: Y = 0
    expect(bbBlocks[0].position.y).toBe(H / 2);
    expect(paramBlocks[0].position.y).toBe(0);
    // BB: Z = D + T/2, Param: Z = D/2 + T/2
    expect(bbBlocks[0].position.z).toBe(D + T / 2);
    expect(paramBlocks[0].position.z).toBe(D / 2 + T / 2);
  });
});
