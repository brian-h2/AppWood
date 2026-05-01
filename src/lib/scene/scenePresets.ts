import * as THREE from 'three';
import type { PresetId, ScenePreset } from '../types';

// ---------------------------------------------------------------------------
// Scene preset definitions
// ---------------------------------------------------------------------------

export const SCENE_PRESETS: Record<PresetId, ScenePreset> = {
  kitchen: {
    id: 'kitchen',
    labelEs: 'Cocina básica',
    ambientIntensity: 0.8,
    directionalIntensity: 1.0,
    directionalPosition: [3, 5, 3],
    wallColor: '#F5F5F0',
    floorColor: '#C8B89A',
    roomDimensions: { lengthMm: 4000, widthMm: 3500, heightMm: 2600 },
  },
  bedroom: {
    id: 'bedroom',
    labelEs: 'Dormitorio minimalista',
    ambientIntensity: 0.6,
    directionalIntensity: 0.8,
    directionalPosition: [2, 4, 2],
    wallColor: '#E8E0D8',
    floorColor: '#8B7355',
    roomDimensions: { lengthMm: 4500, widthMm: 3800, heightMm: 2500 },
  },
  'living-room': {
    id: 'living-room',
    labelEs: 'Salón moderno',
    ambientIntensity: 0.7,
    directionalIntensity: 0.9,
    directionalPosition: [4, 6, 2],
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
