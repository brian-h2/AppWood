// Template Registry — pure data module for furniture templates and anchor functions.
// All positions and sizes are in millimetres (mm).
// T = 18 mm is the standard material thickness used throughout.

import type { BuildingBlock, BlockType, MaterialType, EdgeBandingConfig } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateId = 'alacena-cocina' | 'escritorio-flotante' | 'rack-tv-bajo';

export interface TemplateDimensions {
  /** Total external width in mm */
  W: number;
  /** Total external height in mm */
  H: number;
  /** Total external depth in mm */
  D: number;
}

export interface TemplateDef {
  id: TemplateId;
  nameEs: string;
  defaultDimensions: TemplateDimensions;
  /** Pure function: given global dims, returns the full BuildingBlock[] */
  anchorFn: (dims: TemplateDimensions) => BuildingBlock[];
}

// ---------------------------------------------------------------------------
// makeBlock helper
// ---------------------------------------------------------------------------

/**
 * Creates a fully-formed BuildingBlock with sensible defaults.
 * The id is used as-is (stable, deterministic per template piece).
 */
function makeBlock(
  id: string,
  type: BlockType,
  position: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
): BuildingBlock {
  const edgeBanding: EdgeBandingConfig = { faces: {} };
  const material: MaterialType = 'melamine-18';

  return {
    id,
    type,
    position,
    size,
    rotation: { x: 0, y: 0, z: 0 },
    edgeBanding,
    grainDirection: 'none',
    parentId: null,
    visualValidationStatus: 'ok',
    connections: [],
    material,
  };
}

// ---------------------------------------------------------------------------
// Anchor functions
// ---------------------------------------------------------------------------

/**
 * Alacena de Cocina — 8 pieces.
 * Guard: pieces with any size dimension ≤ 0 are skipped.
 */
function alacenaAnchorFn({ W, H, D }: TemplateDimensions): BuildingBlock[] {
  const T = 18;

  const candidates: BuildingBlock[] = [
    makeBlock(
      'alacena-lateral-izq',
      'side-panel',
      { x: T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    makeBlock(
      'alacena-lateral-der',
      'side-panel',
      { x: W - T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    makeBlock(
      'alacena-techo',
      'shelf',
      { x: W / 2, y: H - T / 2, z: D / 2 },
      { x: W - 2 * T, y: T, z: D },
    ),
    makeBlock(
      'alacena-piso',
      'shelf',
      { x: W / 2, y: T / 2, z: D / 2 },
      { x: W - 2 * T, y: T, z: D },
    ),
    makeBlock(
      'alacena-estante',
      'shelf',
      { x: W / 2, y: H / 2, z: (D - 20) / 2 + 10 },
      { x: W - 2 * T - 2, y: T, z: D - 20 },
    ),
    makeBlock(
      'alacena-fondo',
      'back-panel',
      { x: W / 2, y: H / 2, z: 1.5 },
      { x: W, y: H, z: 3 },
    ),
    makeBlock(
      'alacena-puerta-izq',
      'side-panel',
      { x: W / 4, y: H / 2, z: D + T / 2 },
      { x: W / 2 - 2, y: H - 4, z: T },
    ),
    makeBlock(
      'alacena-puerta-der',
      'side-panel',
      { x: (3 * W) / 4, y: H / 2, z: D + T / 2 },
      { x: W / 2 - 2, y: H - 4, z: T },
    ),
  ];

  return candidates.filter(
    (b) => b.size.x > 0 && b.size.y > 0 && b.size.z > 0,
  );
}

/**
 * Escritorio Flotante — 6 pieces.
 * Guard: pieces with any size dimension ≤ 0 are skipped.
 */
function escritorioAnchorFn({ W, H, D }: TemplateDimensions): BuildingBlock[] {
  const T = 18;

  const candidates: BuildingBlock[] = [
    makeBlock(
      'escritorio-tapa',
      'shelf',
      { x: W / 2, y: H, z: D / 2 },
      { x: W, y: T, z: D },
    ),
    makeBlock(
      'escritorio-base',
      'shelf',
      { x: W / 2, y: T / 2, z: D / 2 },
      { x: W - 2 * T, y: T, z: D },
    ),
    makeBlock(
      'escritorio-lateral-izq',
      'side-panel',
      { x: T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    makeBlock(
      'escritorio-lateral-der',
      'side-panel',
      { x: W - T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    makeBlock(
      'escritorio-divisor',
      'side-panel',
      { x: W / 2, y: H / 2, z: D / 2 },
      { x: T, y: H - 2 * T, z: D },
    ),
    makeBlock(
      'escritorio-refuerzo',
      'back-panel',
      { x: W / 2, y: H / 2, z: 1.5 },
      { x: W, y: H, z: 3 },
    ),
  ];

  return candidates.filter(
    (b) => b.size.x > 0 && b.size.y > 0 && b.size.z > 0,
  );
}

/**
 * Rack de TV Bajo — 7 pieces.
 * Guard: pieces with any size dimension ≤ 0 are skipped.
 */
function rackTvAnchorFn({ W, H, D }: TemplateDimensions): BuildingBlock[] {
  const T = 18;

  const candidates: BuildingBlock[] = [
    makeBlock(
      'rack-tapa',
      'shelf',
      { x: W / 2, y: H - T / 2, z: D / 2 },
      { x: W - 2 * T, y: T, z: D },
    ),
    makeBlock(
      'rack-base',
      'shelf',
      { x: W / 2, y: T / 2, z: D / 2 },
      { x: W - 2 * T, y: T, z: D },
    ),
    makeBlock(
      'rack-lateral-izq',
      'side-panel',
      { x: T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    makeBlock(
      'rack-lateral-der',
      'side-panel',
      { x: W - T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    makeBlock(
      'rack-divisor-izq',
      'side-panel',
      { x: W / 3, y: H / 2, z: D / 2 },
      { x: T, y: H - 2 * T, z: D },
    ),
    makeBlock(
      'rack-divisor-der',
      'side-panel',
      { x: (2 * W) / 3, y: H / 2, z: D / 2 },
      { x: T, y: H - 2 * T, z: D },
    ),
    makeBlock(
      'rack-fondo',
      'back-panel',
      { x: W / 2, y: H / 2, z: 1.5 },
      { x: W, y: H, z: 3 },
    ),
  ];

  return candidates.filter(
    (b) => b.size.x > 0 && b.size.y > 0 && b.size.z > 0,
  );
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TEMPLATE_REGISTRY: Record<TemplateId, TemplateDef> = {
  'alacena-cocina': {
    id: 'alacena-cocina',
    nameEs: 'Alacena de Cocina',
    defaultDimensions: { W: 800, H: 600, D: 300 },
    anchorFn: alacenaAnchorFn,
  },
  'escritorio-flotante': {
    id: 'escritorio-flotante',
    nameEs: 'Escritorio Flotante',
    defaultDimensions: { W: 1200, H: 150, D: 500 },
    anchorFn: escritorioAnchorFn,
  },
  'rack-tv-bajo': {
    id: 'rack-tv-bajo',
    nameEs: 'Rack de TV Bajo',
    defaultDimensions: { W: 1600, H: 450, D: 400 },
    anchorFn: rackTvAnchorFn,
  },
};

/**
 * Returns the TemplateDef for the given id.
 * TypeScript's union type guarantees id is always valid at compile time.
 */
export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATE_REGISTRY[id];
}
