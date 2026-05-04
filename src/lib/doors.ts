/**
 * Door calculation module for DoselCode.
 *
 * Implements real carpentry sizing rules:
 *   - Overlay (capa): door covers the lateral panel edges
 *   - Inset (insertada): door sits inside the frame
 *
 * Gap constants follow industry standard:
 *   - 2 mm per side for overlay (4 mm total width gap for double)
 *   - 2 mm per side for inset (4 mm total clearance inside frame)
 *
 * Pivot is placed at the hinge edge (not the centre) for correct rotation.
 *
 * Units: millimetres (mm) throughout.
 */

import type {
  DoorBlock,
  DoorConfig,
  MaterialType,
  EdgeBandingConfig,
} from './types';
import { MATERIAL_SPECS } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Gap between door edge and frame/adjacent door (mm) */
const GAP = 2;

/** Maximum safe width/height ratio for a door panel before hinge stress warning */
const MAX_DOOR_ASPECT_RATIO = 0.65;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allFourEdges(): EdgeBandingConfig {
  const face = { thicknessMm: 0.5, material: 'pvc' as const };
  return {
    faces: {
      top: face,
      bottom: face,
      left: face,
      right: face,
    },
  };
}

function makeDoorBlock(
  id: string,
  position: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
  pivotSide: 'left' | 'right',
  config: DoorConfig,
  material: MaterialType,
): DoorBlock {
  return {
    id,
    type: 'door',
    position,
    size,
    rotation: { x: 0, y: 0, z: 0 },
    material,
    connections: [],
    edgeBanding: allFourEdges(),
    grainDirection: 'vertical', // doors typically have vertical grain
    parentId: null,
    visualValidationStatus: 'ok',
    isDoor: true,
    pivotSide,
    hardwareStyle: config.hardwareStyle,
    hardwarePosition: config.hardwarePosition,
  };
}

// ---------------------------------------------------------------------------
// Size calculation
// ---------------------------------------------------------------------------

export interface DoorSizeResult {
  /** Width of each door panel in mm */
  Wp: number;
  /** Height of each door panel in mm */
  Hp: number;
  /** Number of door panels (1 or 2) */
  count: number;
}

/**
 * Calculates door panel dimensions based on cabinet dimensions and config.
 *
 * @param W  Cabinet total width (mm)
 * @param H  Cabinet total height (mm)
 * @param T  Material thickness (mm)
 * @param config  Door configuration
 */
export function calcDoorSize(
  W: number,
  H: number,
  T: number,
  config: DoorConfig,
): DoorSizeResult | null {
  if (config.type === 'none') return null;

  if (config.mount === 'overlay') {
    if (config.type === 'double') {
      return {
        Wp: W / 2 - GAP,
        Hp: H - GAP * 2,
        count: 2,
      };
    }
    // single overlay
    return {
      Wp: W - GAP * 2,
      Hp: H - GAP * 2,
      count: 1,
    };
  }

  // inset
  if (config.type === 'double') {
    return {
      Wp: (W - 2 * T) / 2 - GAP,
      Hp: H - 2 * T - GAP * 2,
      count: 2,
    };
  }
  // single inset
  return {
    Wp: W - 2 * T - GAP * 2,
    Hp: H - 2 * T - GAP * 2,
    count: 1,
  };
}

// ---------------------------------------------------------------------------
// Structural validation
// ---------------------------------------------------------------------------

export interface DoorValidationResult {
  status: 'ok' | 'warning' | 'error';
  message: string | null;
}

/**
 * Validates that the door panel dimensions are structurally safe.
 *
 * Rules:
 *   - Width/Height ratio > MAX_DOOR_ASPECT_RATIO → warning (hinge stress)
 *   - Width > material maxSpanMm → error (panel too wide for material)
 *   - Any dimension ≤ 0 → error (degenerate)
 */
export function validateDoor(
  size: DoorSizeResult,
  material: MaterialType,
): DoorValidationResult {
  const { Wp, Hp } = size;
  const spec = MATERIAL_SPECS[material];

  if (Wp <= 0 || Hp <= 0) {
    return {
      status: 'error',
      message: 'Las dimensiones del mueble son demasiado pequeñas para agregar puertas.',
    };
  }

  if (Wp > spec.maxSpanMm) {
    return {
      status: 'error',
      message: `La puerta (${Math.round(Wp)} mm de ancho) supera el vano máximo del material (${spec.maxSpanMm} mm). Riesgo de pandeo.`,
    };
  }

  if (Wp / Hp > MAX_DOOR_ASPECT_RATIO) {
    return {
      status: 'warning',
      message: `La relación ancho/alto de la puerta (${(Wp / Hp).toFixed(2)}) es alta. Puede generar esfuerzo excesivo en las bisagras.`,
    };
  }

  return { status: 'ok', message: null };
}

// ---------------------------------------------------------------------------
// Block generation
// ---------------------------------------------------------------------------

/**
 * Generates DoorBlock(s) for the given cabinet dimensions and door config.
 *
 * Coordinate system: **Building Blocks** (origin at bottom-left-back corner).
 *   - X: 0 (left) → W (right)
 *   - Y: 0 (floor) → H (top)
 *   - Z: 0 (back) → D (front)
 *
 * @param W  Cabinet total width (mm)
 * @param H  Cabinet total height (mm)
 * @param D  Cabinet total depth (mm)
 * @param config  Door configuration
 * @param material  Material type
 * @param templateId  Used to generate stable block IDs
 */
export function computeDoorBlocks(
  W: number,
  H: number,
  D: number,
  config: DoorConfig,
  material: MaterialType,
  templateId: string,
): DoorBlock[] {
  if (config.type === 'none') return [];

  const T = MATERIAL_SPECS[material].thickness;
  const sizeResult = calcDoorSize(W, H, T, config);
  if (!sizeResult) return [];

  const { Wp, Hp, count } = sizeResult;
  if (Wp <= 0 || Hp <= 0) return [];

  // Z position of door centre (BB coords: back=0, front=D)
  const doorZ = config.mount === 'overlay'
    ? D + T / 2          // in front of cabinet
    : D - T / 2;         // inset, flush with front

  const doorY = H / 2;  // vertically centred

  if (count === 1) {
    const doorX = W / 2;
    const pivotSide = config.swing === 'left' ? 'left' : 'right';
    return [
      makeDoorBlock(
        `${templateId}-door-single`,
        { x: doorX, y: doorY, z: doorZ },
        { x: Wp, y: Hp, z: T },
        pivotSide,
        config,
        material,
      ),
    ];
  }

  // Double doors: left panel hinges on left, right panel hinges on right
  const leftX = W / 4;
  const rightX = (3 * W) / 4;

  return [
    makeDoorBlock(
      `${templateId}-door-left`,
      { x: leftX, y: doorY, z: doorZ },
      { x: Wp, y: Hp, z: T },
      'left',
      config,
      material,
    ),
    makeDoorBlock(
      `${templateId}-door-right`,
      { x: rightX, y: doorY, z: doorZ },
      { x: Wp, y: Hp, z: T },
      'right',
      config,
      material,
    ),
  ];
}

/**
 * Generates DoorBlock(s) for the **parametric mode** coordinate system.
 *
 * Coordinate system: **centred** (origin at geometric centre of the cabinet).
 *   - X: -W/2 (left) → +W/2 (right)  →  door centre at 0 (single) or ±W/4 (double)
 *   - Y: -H/2 (floor) → +H/2 (top)   →  door centre at 0
 *   - Z: -D/2 (back) → +D/2 (front)  →  door front face at +D/2
 *
 * The `yOffset` applied in Viewer3D lifts the whole group by H/2, so the
 * door Y=0 lands at the correct visual centre of the cabinet.
 */
export function computeDoorBlocksParametric(
  W: number,
  H: number,
  D: number,
  config: DoorConfig,
  material: MaterialType,
): DoorBlock[] {
  if (config.type === 'none') return [];

  const T = MATERIAL_SPECS[material].thickness;
  const sizeResult = calcDoorSize(W, H, T, config);
  if (!sizeResult) return [];

  const { Wp, Hp, count } = sizeResult;
  if (Wp <= 0 || Hp <= 0) return [];

  // In centred coords: front face of cabinet is at Z = +D/2
  const doorZ = config.mount === 'overlay'
    ? D / 2 + T / 2      // slightly in front of the cabinet front face
    : D / 2 - T / 2;     // inset: door sits inside, flush with front

  // Y centre of the cabinet is 0 in centred coords
  const doorY = 0;

  if (count === 1) {
    // X centre of cabinet is 0
    const doorX = 0;
    const pivotSide = config.swing === 'left' ? 'left' : 'right';
    return [
      makeDoorBlock(
        'parametric-door-single',
        { x: doorX, y: doorY, z: doorZ },
        { x: Wp, y: Hp, z: T },
        pivotSide,
        config,
        material,
      ),
    ];
  }

  // Double: left panel centred at -W/4, right at +W/4
  return [
    makeDoorBlock(
      'parametric-door-left',
      { x: -W / 4, y: doorY, z: doorZ },
      { x: Wp, y: Hp, z: T },
      'left',
      config,
      material,
    ),
    makeDoorBlock(
      'parametric-door-right',
      { x: W / 4, y: doorY, z: doorZ },
      { x: Wp, y: Hp, z: T },
      'right',
      config,
      material,
    ),
  ];
}
