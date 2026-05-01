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
    // Porcelain grey floor + white satin walls
    wallColor: '#F5F5F0',
    floorColor: '#C0BCBA',
    floorRoughness: 0.2,
    wallRoughness: 0.35,
    floorMetalness: 0.05,
    floorPattern: 'tile-grid',
    wallPattern: 'paint-flat',
    textureRepeat: 3,
    roomDimensions: { lengthMm: 4000, widthMm: 3500, heightMm: 2600 },
  },
  bathroom: {
    id: 'bathroom',
    labelEs: 'Baño',
    ambientIntensity: 0.8,
    directionalIntensity: 0.6,
    directionalPosition: [1, 4, 1],
    // White ceramic tiles — subtle metalness for gloss
    wallColor: '#F0F4F4',
    floorColor: '#E0E8E8',
    floorRoughness: 0.15,
    wallRoughness: 0.2,
    floorMetalness: 0.1,
    floorPattern: 'tile-grid',
    wallPattern: 'tile-subway',
    textureRepeat: 4,
    roomDimensions: { lengthMm: 2800, widthMm: 2200, heightMm: 2400 },
  },
  bedroom: {
    id: 'bedroom',
    labelEs: 'Dormitorio',
    ambientIntensity: 0.4,
    directionalIntensity: 0.5,
    directionalPosition: [2, 3, 1],
    // Warm wood floor + matte plaster walls
    wallColor: '#E8E0D8',
    floorColor: '#8B7355',
    floorRoughness: 0.8,
    wallRoughness: 0.9,
    floorMetalness: 0.0,
    floorPattern: 'wood-parquet',
    wallPattern: 'plaster',
    textureRepeat: 2,
    roomDimensions: { lengthMm: 4500, widthMm: 3800, heightMm: 2500 },
  },
  'living-room': {
    id: 'living-room',
    labelEs: 'Living',
    ambientIntensity: 0.5,
    directionalIntensity: 1.0,
    directionalPosition: [5, 5, -3],
    // Parquet floor + white walls + cement accent wall (north, behind furniture)
    wallColor: '#F8F8F6',
    floorColor: '#A07850',
    floorRoughness: 0.65,
    wallRoughness: 0.85,
    floorMetalness: 0.0,
    floorPattern: 'wood-parquet',
    wallPattern: 'paint-flat',
    textureRepeat: 3,
    accentWallColor: '#8A8A88', // cement grey accent wall (north)
    roomDimensions: { lengthMm: 6000, widthMm: 5000, heightMm: 2800 },
  },
};

// ---------------------------------------------------------------------------
// Scene builder — independent planes per surface
// ---------------------------------------------------------------------------

const MM_TO_M = 0.001;

/**
 * Builds a Three.js Group with independent PlaneGeometry meshes for:
 *   floor, ceiling, north wall, south wall, east wall, west wall.
 *
 * Using PlaneGeometry (instead of BoxGeometry) gives each surface its own
 * UV space, so textures map correctly without distortion.
 *
 * Textures are generated procedurally via CanvasTexture — no network requests.
 */
export function buildPresetScene(presetId: PresetId): THREE.Group {
  const preset = SCENE_PRESETS[presetId];
  const { lengthMm, widthMm, heightMm } = preset.roomDimensions;

  const lengthM = lengthMm * MM_TO_M;
  const widthM = widthMm * MM_TO_M;
  const heightM = heightMm * MM_TO_M;

  const group = new THREE.Group();

  // Lazy-import procedural textures only when building the scene
  // (avoids running canvas code at module load time in SSR/test environments)
  const { makeFloorTexture, makeWallTexture } = require('./proceduralTextures') as typeof import('./proceduralTextures');

  const floorTex = makeFloorTexture(preset.floorPattern, preset.floorColor);
  floorTex.repeat.set(
    widthM * preset.textureRepeat,
    lengthM * preset.textureRepeat,
  );

  const wallTex = makeWallTexture(preset.wallPattern, preset.wallColor);
  wallTex.repeat.set(
    widthM * preset.textureRepeat,
    heightM * preset.textureRepeat,
  );

  const accentTex = preset.accentWallColor
    ? makeWallTexture('cement', preset.accentWallColor)
    : null;
  if (accentTex) {
    accentTex.repeat.set(widthM * preset.textureRepeat, heightM * preset.textureRepeat);
  }

  // ---- Floor ----
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: preset.floorRoughness,
    metalness: preset.floorMetalness,
  });
  const floorGeo = new THREE.PlaneGeometry(widthM, lengthM);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  group.add(floor);

  // ---- Ceiling ----
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: preset.wallColor,
    roughness: 0.9,
    metalness: 0,
  });
  const ceilingGeo = new THREE.PlaneGeometry(widthM, lengthM);
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, heightM, 0);
  group.add(ceiling);

  // ---- Wall material factory ----
  const makeWallMat = (isAccent = false) =>
    new THREE.MeshStandardMaterial({
      map: isAccent && accentTex ? accentTex : wallTex,
      roughness: preset.wallRoughness,
      metalness: 0,
    });

  // ---- North wall (positive Z — accent wall, behind furniture) ----
  const northGeo = new THREE.PlaneGeometry(widthM, heightM);
  const northWall = new THREE.Mesh(northGeo, makeWallMat(true));
  northWall.rotation.y = Math.PI; // face inward
  northWall.position.set(0, heightM / 2, lengthM / 2);
  northWall.receiveShadow = true;
  group.add(northWall);

  // ---- South wall (negative Z) ----
  const southGeo = new THREE.PlaneGeometry(widthM, heightM);
  const southWall = new THREE.Mesh(southGeo, makeWallMat());
  southWall.position.set(0, heightM / 2, -lengthM / 2);
  southWall.receiveShadow = true;
  group.add(southWall);

  // ---- East wall (positive X) ----
  const eastGeo = new THREE.PlaneGeometry(lengthM, heightM);
  const eastWall = new THREE.Mesh(eastGeo, makeWallMat());
  eastWall.rotation.y = -Math.PI / 2;
  eastWall.position.set(widthM / 2, heightM / 2, 0);
  eastWall.receiveShadow = true;
  group.add(eastWall);

  // ---- West wall (negative X) ----
  const westGeo = new THREE.PlaneGeometry(lengthM, heightM);
  const westWall = new THREE.Mesh(westGeo, makeWallMat());
  westWall.rotation.y = Math.PI / 2;
  westWall.position.set(-widthM / 2, heightM / 2, 0);
  westWall.receiveShadow = true;
  group.add(westWall);

  return group;
}
