import * as THREE from 'three';
import type { PresetId, ScenePreset } from '../types';

// ---------------------------------------------------------------------------
// Scene preset definitions
//
// Lighting philosophy per preset:
//   kitchen / bathroom — Technical, clear light. Neutral white (~6000 K).
//     High ambient (0.8) to eliminate harsh shadows that hinder design work.
//   bedroom — Warm, dim light (~3000 K). Low ambient (0.4) with a soft
//     directional that simulates a bedside lamp or sunset.
//   living-room — Balanced. Strong directional (1.0) at 45° to simulate
//     a large window, generating depth-giving shadows.
// ---------------------------------------------------------------------------

export const SCENE_PRESETS: Record<PresetId, ScenePreset> = {
  kitchen: {
    id: 'kitchen',
    labelEs: 'Cocina',
    ambientIntensity: 0.8,
    directionalIntensity: 0.7,
    directionalPosition: [2, 5, 2],
    wallColor: '#F5F5F0',
    floorColor: '#C8C0B0',
    roomDimensions: { lengthMm: 4000, widthMm: 3500, heightMm: 2600 },
  },
  bathroom: {
    id: 'bathroom',
    labelEs: 'Baño',
    ambientIntensity: 0.8,
    directionalIntensity: 0.6,
    directionalPosition: [1, 4, 1],
    wallColor: '#EAF0F0',
    floorColor: '#B8C4C4',
    roomDimensions: { lengthMm: 2800, widthMm: 2200, heightMm: 2400 },
  },
  bedroom: {
    id: 'bedroom',
    labelEs: 'Dormitorio',
    ambientIntensity: 0.4,
    directionalIntensity: 0.5,
    directionalPosition: [2, 3, 1],
    wallColor: '#E8E0D8',
    floorColor: '#8B7355',
    roomDimensions: { lengthMm: 4500, widthMm: 3800, heightMm: 2500 },
  },
  'living-room': {
    id: 'living-room',
    labelEs: 'Living',
    ambientIntensity: 0.5,
    directionalIntensity: 1.0,
    directionalPosition: [5, 5, -3],
    wallColor: '#FFFFFF',
    floorColor: '#6B5B45',
    roomDimensions: { lengthMm: 6000, widthMm: 5000, heightMm: 2800 },
  },
};

// ---------------------------------------------------------------------------
// Scene builder
// ---------------------------------------------------------------------------

const MM_TO_M = 0.001;

/**
 * Builds a Three.js Group containing the static geometry for the given preset:
 * floor, ceiling, and four walls (north, south, east, west).
 * All geometry uses BoxGeometry with MeshStandardMaterial.
 * Room dimensions are converted from mm to meters using factor 0.001.
 */
export function buildPresetScene(presetId: PresetId): THREE.Group {
  const preset = SCENE_PRESETS[presetId];
  const { lengthMm, widthMm, heightMm } = preset.roomDimensions;

  const lengthM = lengthMm * MM_TO_M;
  const widthM = widthMm * MM_TO_M;
  const heightM = heightMm * MM_TO_M;

  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ color: preset.wallColor });
  const floorMat = new THREE.MeshStandardMaterial({ color: preset.floorColor });

  // Floor — centred at y = 0
  const floorGeo = new THREE.BoxGeometry(widthM, 0.01, lengthM);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, 0, 0);
  group.add(floor);

  // Ceiling — same geometry at y = heightM
  const ceilingGeo = new THREE.BoxGeometry(widthM, 0.01, lengthM);
  const ceiling = new THREE.Mesh(ceilingGeo, wallMat);
  ceiling.position.set(0, heightM, 0);
  group.add(ceiling);

  const wallThickness = 0.01;

  // North wall (positive Z face)
  const northGeo = new THREE.BoxGeometry(widthM, heightM, wallThickness);
  const northWall = new THREE.Mesh(northGeo, wallMat);
  northWall.position.set(0, heightM / 2, lengthM / 2);
  group.add(northWall);

  // South wall (negative Z face)
  const southGeo = new THREE.BoxGeometry(widthM, heightM, wallThickness);
  const southWall = new THREE.Mesh(southGeo, wallMat);
  southWall.position.set(0, heightM / 2, -lengthM / 2);
  group.add(southWall);

  // East wall (positive X face)
  const eastGeo = new THREE.BoxGeometry(wallThickness, heightM, lengthM);
  const eastWall = new THREE.Mesh(eastGeo, wallMat);
  eastWall.position.set(widthM / 2, heightM / 2, 0);
  group.add(eastWall);

  // West wall (negative X face)
  const westGeo = new THREE.BoxGeometry(wallThickness, heightM, lengthM);
  const westWall = new THREE.Mesh(westGeo, wallMat);
  westWall.position.set(-widthM / 2, heightM / 2, 0);
  group.add(westWall);

  return group;
}
