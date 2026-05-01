// Central type definitions for the Furniture Design Platform
// Units: millimeters (mm) in the data model.
// Three.js rendering scales mm → meters (factor 0.001).
// This file has NO runtime dependencies on Three.js.

import type { SheetSize } from './nesting';
import { STANDARD_SHEETS } from './nesting';
import type { ShelfParams, Piece } from './furniture';

// Re-export imported types so consumers can import from a single place
export type { ShelfParams, Piece, SheetSize };

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

export type BlockType = 'side-panel' | 'shelf' | 'drawer' | 'back-panel';

// ---------------------------------------------------------------------------
// Material types
// ---------------------------------------------------------------------------

export type MaterialType = 'melamine-18' | 'mdf-18' | 'solid-wood-20';

export interface MaterialSpec {
  type: MaterialType;
  /** Board thickness in mm */
  thickness: number;
  /** Maximum free span before buckling risk, in mm */
  maxSpanMm: number;
}

export const MATERIAL_SPECS: Record<MaterialType, MaterialSpec> = {
  'melamine-18':   { type: 'melamine-18',   thickness: 18, maxSpanMm: 800  },
  'mdf-18':        { type: 'mdf-18',        thickness: 18, maxSpanMm: 700  },
  'solid-wood-20': { type: 'solid-wood-20', thickness: 20, maxSpanMm: 1000 },
};

// ---------------------------------------------------------------------------
// Edge banding
// ---------------------------------------------------------------------------

export type FaceName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

export interface EdgeBandingFace {
  /** Typically 0.5 mm (thin PVC) or 1 mm (ABS) */
  thicknessMm: number;
  material: 'pvc' | 'abs' | 'wood-veneer';
}

export interface EdgeBandingConfig {
  faces: Partial<Record<FaceName, EdgeBandingFace>>;
}

// ---------------------------------------------------------------------------
// Assembly graph
// ---------------------------------------------------------------------------

export interface ConnectionEdge {
  fromBlockId: string;
  toBlockId: string;
  /** Face index 0-5 (±X, ±Y, ±Z) */
  fromFace: number;
  /** Face index 0-5 (±X, ±Y, ±Z) */
  toFace: number;
}

// ---------------------------------------------------------------------------
// Building block
// ---------------------------------------------------------------------------

export interface BuildingBlock {
  /** UUID */
  id: string;
  type: BlockType;
  /** Centre of the block in mm — plain object, NOT THREE.Vector3 */
  position: { x: number; y: number; z: number };
  /** Dimensions in mm — plain object, NOT THREE.Vector3 */
  size: { x: number; y: number; z: number };
  /** Rotation in radians */
  rotation: { x: number; y: number; z: number };
  material: MaterialType;
  connections: ConnectionEdge[];
  /** Tapacanto (edge banding) configuration per face */
  edgeBanding: EdgeBandingConfig;
  /**
   * Grain direction constraint for nesting.
   * When !== 'none' the piece must NOT be rotated 90° during optimisation.
   */
  grainDirection: 'horizontal' | 'vertical' | 'none';
  /**
   * Parent block id for the parent-child hierarchy.
   * null = root block. Set automatically when snapping to a side-panel.
   */
  parentId: string | null;
  /** Visual preventive validation status */
  visualValidationStatus: 'ok' | 'warning' | 'error';
}

// ---------------------------------------------------------------------------
// AABB
// ---------------------------------------------------------------------------

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/**
 * Derives an Axis-Aligned Bounding Box from a BuildingBlock's position and size.
 * Pure function — no Three.js dependency.
 */
export function blockToAABB(block: BuildingBlock): AABB {
  return {
    minX: block.position.x - block.size.x / 2,
    maxX: block.position.x + block.size.x / 2,
    minY: block.position.y - block.size.y / 2,
    maxY: block.position.y + block.size.y / 2,
    minZ: block.position.z - block.size.z / 2,
    maxZ: block.position.z + block.size.z / 2,
  };
}

// ---------------------------------------------------------------------------
// Assembly graph
// ---------------------------------------------------------------------------

export interface AssemblyGraph {
  nodes: Map<string, BuildingBlock>;
  edges: ConnectionEdge[];
}

/** Serialised form for JSON payloads (e.g. Lambda). Uses arrays instead of Maps. */
export interface AssemblyGraphPayload {
  nodes: Array<{
    id: string;
    type: BlockType;
    position: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
    material: MaterialType;
    grainDirection: 'horizontal' | 'vertical' | 'none';
    parentId: string | null;
  }>;
  edges: ConnectionEdge[];
  /** Saw kerf thickness in mm (typically 3.2 mm) */
  sawKerfMm: number;
}

// ---------------------------------------------------------------------------
// Furniture model (central state)
// ---------------------------------------------------------------------------

export interface FurnitureModel {
  // Parametric mode (existing)
  params: ShelfParams;
  pieces: Piece[];

  // Building Blocks mode (new)
  blocks: BuildingBlock[];
  assemblyGraph: AssemblyGraph;
  selectedMaterial: MaterialType;

  // Active design mode
  designMode: 'parametric' | 'blocks';
}

// ---------------------------------------------------------------------------
// Cut list
// ---------------------------------------------------------------------------

export interface EdgeBandingCorrection {
  face: FaceName;
  thicknessMm: number;
  affectedDimension: 'length' | 'width';
  /** Amount subtracted from the cut dimension (= thicknessMm) */
  correctionMm: number;
}

export interface CutListItem {
  blockId: string;
  name: string;
  /** Nominal (design) length in mm — never modified by edge banding */
  nominalLengthMm: number;
  /** Nominal (design) width in mm — never modified by edge banding */
  nominalWidthMm: number;
  thicknessMm: number;
  qty: number;
  /** Actual cut length after edge banding compensation */
  cutLengthMm: number;
  /** Actual cut width after edge banding compensation */
  cutWidthMm: number;
  edgeBandingCorrections: EdgeBandingCorrection[];
}

// ---------------------------------------------------------------------------
// Nesting
// ---------------------------------------------------------------------------

export interface NestingConfig {
  sheet: SheetSize;
  /**
   * Saw blade kerf in mm.
   * Typical values: 3.2 mm (standard blade), 2.8 mm (thin blade).
   * Added to the gap between pieces when calculating how many fit on a sheet.
   */
  sawKerfMm: number;
}

export const DEFAULT_NESTING_CONFIG: NestingConfig = {
  sheet: STANDARD_SHEETS[0], // Melamina 2440 × 1830
  sawKerfMm: 3.2,
};

// ---------------------------------------------------------------------------
// Room configuration
// ---------------------------------------------------------------------------

export interface RoomDimensions {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export type WallSide = 'north' | 'south' | 'east' | 'west';

export interface RoomObstacle {
  id: string;
  type: 'window' | 'door';
  wall: WallSide;
  heightFromFloorMm: number;
  widthMm: number;
  heightMm: number;
  offsetFromLeftMm: number;
}

export interface RoomConfiguration {
  dimensions: RoomDimensions;
  obstacles: RoomObstacle[];
}

export interface RoomConfigurationExport {
  version: '1.0';
  /** ISO 8601 timestamp */
  createdAt: string;
  dimensions: RoomDimensions;
  obstacles: RoomObstacle[];
  furnitureSnapshot?: {
    designMode: 'parametric' | 'blocks';
    params?: ShelfParams;
    blocks?: BuildingBlock[];
  };
}

// ---------------------------------------------------------------------------
// Scene presets
// ---------------------------------------------------------------------------

export type PresetId = 'kitchen' | 'bedroom' | 'living-room';

export interface ScenePreset {
  id: PresetId;
  labelEs: string;
  ambientIntensity: number;
  directionalIntensity: number;
  directionalPosition: [number, number, number];
  wallColor: string;
  floorColor: string;
  roomDimensions: RoomDimensions;
}

// ---------------------------------------------------------------------------
// Structural validation
// ---------------------------------------------------------------------------

export interface ValidationAlert {
  affectedPieceIds: string[];
  spanMm: number;
  maxAllowedMm: number;
  material: MaterialType;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  alerts: ValidationAlert[];
  source: 'lambda' | 'client-fallback';
}

export interface SpanValidationResult {
  /** 'warning' when span > maxSpanMm * 0.9; 'error' when span > maxSpanMm */
  status: 'ok' | 'warning' | 'error';
  spanMm: number;
  maxAllowedMm: number;
}

/** Colour overrides for Three.js MeshStandardMaterial based on validation status */
export const VALIDATION_COLORS = {
  ok:      null,        // no override — use base material colour
  warning: '#FF8C00',   // orange
  error:   '#FF0000',   // red
} as const;

// ---------------------------------------------------------------------------
// Lambda API
// ---------------------------------------------------------------------------

export interface LambdaRequest {
  assemblyGraph: AssemblyGraphPayload;
  material: MaterialType;
}

export interface LambdaResponse {
  valid: boolean;
  alerts: ValidationAlert[];
  processingTimeMs: number;
}
