import { describe, it, expect } from 'vitest';
import { getChildren, propagateMovement } from './snapEngine';
import type { BuildingBlock } from '../types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeBlock(
  id: string,
  parentId: string | null = null,
  position = { x: 0, y: 0, z: 0 },
): BuildingBlock {
  return {
    id,
    type: 'side-panel',
    position,
    size: { x: 100, y: 200, z: 18 },
    rotation: { x: 0, y: 0, z: 0 },
    material: 'melamine-18',
    connections: [],
    edgeBanding: { faces: {} },
    grainDirection: 'none',
    parentId,
    visualValidationStatus: 'ok',
  };
}

// ---------------------------------------------------------------------------
// getChildren
// ---------------------------------------------------------------------------

describe('getChildren', () => {
  it('returns direct children of a block', () => {
    const parent = makeBlock('p');
    const child1 = makeBlock('c1', 'p');
    const child2 = makeBlock('c2', 'p');
    const unrelated = makeBlock('u', null);

    const result = getChildren('p', [parent, child1, child2, unrelated]);
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.id)).toEqual(expect.arrayContaining(['c1', 'c2']));
  });

  it('returns an empty array when the block has no children', () => {
    const parent = makeBlock('p');
    const unrelated = makeBlock('u', null);

    expect(getChildren('p', [parent, unrelated])).toHaveLength(0);
  });

  it('returns an empty array for an unknown blockId', () => {
    const block = makeBlock('a');
    expect(getChildren('nonexistent', [block])).toHaveLength(0);
  });

  it('does not include grandchildren (only direct children)', () => {
    const parent = makeBlock('p');
    const child = makeBlock('c', 'p');
    const grandchild = makeBlock('gc', 'c');

    const result = getChildren('p', [parent, child, grandchild]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c');
  });
});

// ---------------------------------------------------------------------------
// propagateMovement
// ---------------------------------------------------------------------------

describe('propagateMovement', () => {
  const delta = { x: 10, y: 20, z: 30 };

  it('moves the parent block by the delta', () => {
    const parent = makeBlock('p', null, { x: 0, y: 0, z: 0 });
    const result = propagateMovement('p', delta, [parent]);

    const updated = result.find((b) => b.id === 'p')!;
    expect(updated.position).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('moves direct children by the same delta', () => {
    const parent = makeBlock('p', null, { x: 0, y: 0, z: 0 });
    const child = makeBlock('c', 'p', { x: 50, y: 0, z: 0 });

    const result = propagateMovement('p', delta, [parent, child]);

    const updatedChild = result.find((b) => b.id === 'c')!;
    expect(updatedChild.position).toEqual({ x: 60, y: 20, z: 30 });
  });

  it('moves grandchildren recursively', () => {
    const parent = makeBlock('p', null, { x: 0, y: 0, z: 0 });
    const child = makeBlock('c', 'p', { x: 50, y: 0, z: 0 });
    const grandchild = makeBlock('gc', 'c', { x: 100, y: 0, z: 0 });

    const result = propagateMovement('p', delta, [parent, child, grandchild]);

    const updatedGc = result.find((b) => b.id === 'gc')!;
    expect(updatedGc.position).toEqual({ x: 110, y: 20, z: 30 });
  });

  it('does not mutate the original blocks array', () => {
    const parent = makeBlock('p', null, { x: 0, y: 0, z: 0 });
    const original = [parent];
    const originalPos = { ...parent.position };

    propagateMovement('p', delta, original);

    expect(original[0].position).toEqual(originalPos);
  });

  it('does not affect unrelated blocks', () => {
    const parent = makeBlock('p', null, { x: 0, y: 0, z: 0 });
    const unrelated = makeBlock('u', null, { x: 500, y: 500, z: 500 });

    const result = propagateMovement('p', delta, [parent, unrelated]);

    const updatedUnrelated = result.find((b) => b.id === 'u')!;
    expect(updatedUnrelated.position).toEqual({ x: 500, y: 500, z: 500 });
  });

  it('handles a zero delta (no movement)', () => {
    const parent = makeBlock('p', null, { x: 10, y: 20, z: 30 });
    const result = propagateMovement('p', { x: 0, y: 0, z: 0 }, [parent]);

    expect(result.find((b) => b.id === 'p')!.position).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('handles a multi-level hierarchy (3 levels deep)', () => {
    const root = makeBlock('root', null, { x: 0, y: 0, z: 0 });
    const child = makeBlock('child', 'root', { x: 10, y: 0, z: 0 });
    const grandchild = makeBlock('gc', 'child', { x: 20, y: 0, z: 0 });
    const greatGrandchild = makeBlock('ggc', 'gc', { x: 30, y: 0, z: 0 });

    const result = propagateMovement('root', { x: 5, y: 5, z: 5 }, [
      root,
      child,
      grandchild,
      greatGrandchild,
    ]);

    expect(result.find((b) => b.id === 'root')!.position).toEqual({ x: 5, y: 5, z: 5 });
    expect(result.find((b) => b.id === 'child')!.position).toEqual({ x: 15, y: 5, z: 5 });
    expect(result.find((b) => b.id === 'gc')!.position).toEqual({ x: 25, y: 5, z: 5 });
    expect(result.find((b) => b.id === 'ggc')!.position).toEqual({ x: 35, y: 5, z: 5 });
  });
});
