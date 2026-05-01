// Template Registry — pure data module for furniture templates and anchor functions.
// All positions and sizes are in millimetres (mm).
// T = 18 mm is the standard material thickness used throughout.

import type { BuildingBlock, BlockType, MaterialType, EdgeBandingConfig } from '../types';
import type { PresetId } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateId =
  | 'alacena-cocina'
  | 'escritorio-flotante'
  | 'rack-tv-bajo'
  | 'vestidor-abierto'
  | 'vanitory-suspendido'
  | 'biblioteca-piso';

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
  /**
   * Scene preset that best matches this template's category.
   * Used by the store to auto-apply the environment when a template is selected.
   */
  autoPresetId: PresetId;
  /**
   * Floor offset in mm applied to the furniture group in the viewer.
   * 0 = rests on the floor. Positive = elevated (e.g. suspended vanitory at 200 mm).
   */
  floorOffsetMm: number;
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

/**
 * Vestidor / Ropero Modular Abierto — 9 pieces.
 *
 * Layout:
 *   - 2 laterales exteriores (envuelven techo y piso)
 *   - Techo y piso internos (W - 2T)
 *   - Estante maletero superior a 400 mm del techo
 *   - Divisor vertical inferior (60/40): divide el espacio bajo el maletero
 *   - Barral de colgado en la sección grande (60 %) — bloque 20×20 mm
 *   - Fondo MDF 3 mm
 *
 * Guard: pieces with any size dimension ≤ 0 are skipped.
 */
function vestidorAnchorFn({ W, H, D }: TemplateDimensions): BuildingBlock[] {
  const T = 18;

  // Estante maletero: a 400 mm del techo interior
  // Su cara inferior queda a H - T (techo) - 400 mm
  const maletoroY = H - T - 400; // Y del centro del estante maletero
  const maletoroH = T;

  // Espacio inferior: desde el piso (T) hasta el maletero (maletoroY - T/2)
  const espacioInferiorH = maletoroY - maletoroH / 2 - T;

  // Divisor vertical inferior: 60/40 del ancho interior (W - 2T)
  const anchoInterior = W - 2 * T;
  const seccionGrande = anchoInterior * 0.6; // sección izquierda (60 %)
  const divisorX = T + seccionGrande; // X del centro del divisor

  // Barral: en la sección grande, a media altura del espacio inferior
  // Ancho del barral = seccionGrande - 2 mm de holgura
  const barralAncho = seccionGrande - 2;
  const barralY = T + espacioInferiorH / 2; // mitad del espacio inferior

  const candidates: BuildingBlock[] = [
    // Laterales exteriores
    makeBlock(
      'vestidor-lateral-izq',
      'side-panel',
      { x: T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    makeBlock(
      'vestidor-lateral-der',
      'side-panel',
      { x: W - T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    // Techo y piso internos
    makeBlock(
      'vestidor-techo',
      'shelf',
      { x: W / 2, y: H - T / 2, z: D / 2 },
      { x: W - 2 * T, y: T, z: D },
    ),
    makeBlock(
      'vestidor-piso',
      'shelf',
      { x: W / 2, y: T / 2, z: D / 2 },
      { x: W - 2 * T, y: T, z: D },
    ),
    // Estante maletero superior
    makeBlock(
      'vestidor-maletero',
      'shelf',
      { x: W / 2, y: maletoroY, z: D / 2 },
      { x: W - 2 * T - 2, y: T, z: D - 10 },
    ),
    // Divisor vertical inferior (60/40)
    makeBlock(
      'vestidor-divisor',
      'side-panel',
      { x: divisorX, y: T + espacioInferiorH / 2, z: D / 2 },
      { x: T, y: espacioInferiorH, z: D },
    ),
    // Barral de colgado en la sección grande (bloque 20×20 mm)
    makeBlock(
      'vestidor-barral',
      'shelf',
      { x: T + seccionGrande / 2, y: barralY, z: D / 2 },
      { x: barralAncho, y: 20, z: 20 },
    ),
    // Fondo MDF
    makeBlock(
      'vestidor-fondo',
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
 * Vanitory de Baño Suspendido — 7 pieces.
 *
 * Layout:
 *   - 2 laterales
 *   - Base inferior
 *   - Frente de cajón (gran formato, cubre casi toda la cara frontal)
 *   - Contrafrente U-Shape: modelado como 2 bloques laterales internos que
 *     dejan un hueco central de 150 mm para el paso del sifón
 *   - 2 listones de amarre superiores traseros (fijación a pared)
 *
 * Material por defecto: mdf-18 (hidrófugo).
 * Guard: pieces with any size dimension ≤ 0 are skipped.
 */
function vanitoryAnchorFn({ W, H, D }: TemplateDimensions): BuildingBlock[] {
  const T = 18;

  // Contrafrente U-Shape: hueco central de 150 mm para el sifón
  // Los dos bloques flanquean el hueco simétricamente
  const huecoSifon = 150;
  const anchoInterior = W - 2 * T;
  const anchoFlancoUShape = (anchoInterior - huecoSifon) / 2;

  // Listones de amarre: 100 mm de alto, en la parte superior trasera
  const listonH = 100;

  const candidates: BuildingBlock[] = [
    // Laterales
    makeBlock(
      'vanitory-lateral-izq',
      'side-panel',
      { x: T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    makeBlock(
      'vanitory-lateral-der',
      'side-panel',
      { x: W - T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    // Base inferior
    makeBlock(
      'vanitory-base',
      'shelf',
      { x: W / 2, y: T / 2, z: D / 2 },
      { x: W - 2 * T, y: T, z: D },
    ),
    // Frente de cajón (gran formato)
    makeBlock(
      'vanitory-frente-cajon',
      'side-panel',
      { x: W / 2, y: H / 2, z: D + T / 2 },
      { x: W - 4, y: H - 4, z: T },
    ),
    // Contrafrente U-Shape — flanco izquierdo
    makeBlock(
      'vanitory-ushape-izq',
      'side-panel',
      { x: T + anchoFlancoUShape / 2, y: H / 2, z: D / 2 },
      { x: anchoFlancoUShape, y: H - 2 * T, z: T },
    ),
    // Contrafrente U-Shape — flanco derecho
    makeBlock(
      'vanitory-ushape-der',
      'side-panel',
      { x: W - T - anchoFlancoUShape / 2, y: H / 2, z: D / 2 },
      { x: anchoFlancoUShape, y: H - 2 * T, z: T },
    ),
    // Listón de amarre izquierdo (superior trasero)
    makeBlock(
      'vanitory-liston-izq',
      'shelf',
      { x: W / 4, y: H - T - listonH / 2, z: T / 2 },
      { x: (W - 2 * T) / 2, y: listonH, z: T },
    ),
    // Listón de amarre derecho (superior trasero)
    makeBlock(
      'vanitory-liston-der',
      'shelf',
      { x: (3 * W) / 4, y: H - T - listonH / 2, z: T / 2 },
      { x: (W - 2 * T) / 2, y: listonH, z: T },
    ),
  ];

  return candidates.filter(
    (b) => b.size.x > 0 && b.size.y > 0 && b.size.z > 0,
  );
}

/**
 * Biblioteca de Piso Multimódulo — 10 pieces.
 *
 * Layout:
 *   - 2 laterales interiores (techo y piso son de ancho completo W)
 *   - Techo y piso de ancho completo (W × T × D)
 *   - 4 estantes regulables distribuidos uniformemente en el espacio interior
 *   - Zócalo frontal inferior (W × 60 × T) debajo del piso
 *   - Fondo enterizo MDF 3 mm
 *
 * Los 4 estantes se distribuyen uniformemente en el espacio interior
 * (entre piso y techo), lo que maximiza la carga sobre el validador de vano.
 *
 * Guard: pieces with any size dimension ≤ 0 are skipped.
 */
function bibliotecaAnchorFn({ W, H, D }: TemplateDimensions): BuildingBlock[] {
  const T = 18;
  const ZOCALO_H = 60;
  const N_ESTANTES = 4;

  // Espacio interior vertical: entre cara superior del piso y cara inferior del techo
  // Piso: centro en T/2, cara superior en T
  // Techo: centro en H - T/2, cara inferior en H - T
  const espacioInteriorH = H - T - T; // = H - 2T
  // Distribuir N_ESTANTES en el espacio interior
  const paso = espacioInteriorH / (N_ESTANTES + 1);

  const estantes: BuildingBlock[] = Array.from({ length: N_ESTANTES }, (_, i) => {
    const estanteY = T + paso * (i + 1); // Y del centro del estante
    return makeBlock(
      `biblioteca-estante-${i + 1}`,
      'shelf',
      { x: W / 2, y: estanteY, z: (D - 10) / 2 + 5 },
      { x: W - 2 * T - 2, y: T, z: D - 10 },
    );
  });

  const candidates: BuildingBlock[] = [
    // Laterales interiores
    makeBlock(
      'biblioteca-lateral-izq',
      'side-panel',
      { x: T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    makeBlock(
      'biblioteca-lateral-der',
      'side-panel',
      { x: W - T / 2, y: H / 2, z: D / 2 },
      { x: T, y: H, z: D },
    ),
    // Techo de ancho completo (laterales van por dentro)
    makeBlock(
      'biblioteca-techo',
      'shelf',
      { x: W / 2, y: H - T / 2, z: D / 2 },
      { x: W, y: T, z: D },
    ),
    // Piso de ancho completo
    makeBlock(
      'biblioteca-piso',
      'shelf',
      { x: W / 2, y: T / 2, z: D / 2 },
      { x: W, y: T, z: D },
    ),
    // Zócalo frontal inferior (debajo del piso)
    makeBlock(
      'biblioteca-zocalo',
      'shelf',
      { x: W / 2, y: -(ZOCALO_H / 2), z: D / 2 },
      { x: W, y: ZOCALO_H, z: T },
    ),
    // Fondo enterizo MDF 3 mm
    makeBlock(
      'biblioteca-fondo',
      'back-panel',
      { x: W / 2, y: H / 2, z: 1.5 },
      { x: W, y: H, z: 3 },
    ),
    // 4 estantes regulables
    ...estantes,
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
    autoPresetId: 'kitchen',
    floorOffsetMm: 0,
  },
  'escritorio-flotante': {
    id: 'escritorio-flotante',
    nameEs: 'Escritorio Flotante',
    defaultDimensions: { W: 1200, H: 150, D: 500 },
    anchorFn: escritorioAnchorFn,
    autoPresetId: 'bedroom',
    floorOffsetMm: 0,
  },
  'rack-tv-bajo': {
    id: 'rack-tv-bajo',
    nameEs: 'Rack de TV Bajo',
    defaultDimensions: { W: 1600, H: 450, D: 400 },
    anchorFn: rackTvAnchorFn,
    autoPresetId: 'living-room',
    floorOffsetMm: 0,
  },
  'vestidor-abierto': {
    id: 'vestidor-abierto',
    nameEs: 'Vestidor Abierto',
    defaultDimensions: { W: 1000, H: 2000, D: 550 },
    anchorFn: vestidorAnchorFn,
    autoPresetId: 'bedroom',
    floorOffsetMm: 0,
  },
  'vanitory-suspendido': {
    id: 'vanitory-suspendido',
    nameEs: 'Vanitory Suspendido',
    defaultDimensions: { W: 600, H: 500, D: 450 },
    anchorFn: vanitoryAnchorFn,
    autoPresetId: 'bathroom',
    floorOffsetMm: 200,
  },
  'biblioteca-piso': {
    id: 'biblioteca-piso',
    nameEs: 'Biblioteca de Piso',
    defaultDimensions: { W: 800, H: 1800, D: 300 },
    anchorFn: bibliotecaAnchorFn,
    autoPresetId: 'living-room',
    floorOffsetMm: 0,
  },
};

/**
 * Returns the TemplateDef for the given id.
 * TypeScript's union type guarantees id is always valid at compile time.
 */
export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATE_REGISTRY[id];
}
