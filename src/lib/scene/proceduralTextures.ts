/**
 * Procedural texture generator for scene presets.
 *
 * All textures are generated on a 256×256 canvas and returned as
 * THREE.CanvasTexture with RepeatWrapping. No network requests — instant load.
 *
 * Patterns available:
 *   Floor: wood-parquet, tile-grid, carpet, concrete
 *   Wall:  plaster, tile-subway, paint-flat, cement
 */

import * as THREE from 'three';

type FloorPattern = 'wood-parquet' | 'tile-grid' | 'carpet' | 'concrete';
type WallPattern = 'plaster' | 'tile-subway' | 'paint-flat' | 'cement';

const SIZE = 256; // canvas resolution in px

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return canvas;
}

function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Adds subtle noise to a canvas context to break up flat fills. */
function addNoise(ctx: CanvasRenderingContext2D, alpha = 0.04): void {
  const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(imageData, 0, 0);
}

// ---------------------------------------------------------------------------
// Floor patterns
// ---------------------------------------------------------------------------

/**
 * Wood parquet — alternating horizontal planks with grain lines.
 * Warm honey-brown tones.
 */
function woodParquet(): THREE.CanvasTexture {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d')!;

  const plankH = 32; // px per plank row
  const grainColors = ['#C8A96E', '#BF9E62', '#D4B47A', '#C2A068'];

  for (let row = 0; row < SIZE / plankH; row++) {
    const baseColor = grainColors[row % grainColors.length];
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, row * plankH, SIZE, plankH);

    // Grain lines
    ctx.strokeStyle = 'rgba(80,50,20,0.12)';
    ctx.lineWidth = 0.8;
    for (let g = 0; g < 6; g++) {
      const y = row * plankH + (g / 6) * plankH + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      // Slight wave
      ctx.bezierCurveTo(SIZE * 0.3, y + 1.5, SIZE * 0.7, y - 1.5, SIZE, y);
      ctx.stroke();
    }

    // Plank separator
    ctx.strokeStyle = 'rgba(60,35,10,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, row * plankH);
    ctx.lineTo(SIZE, row * plankH);
    ctx.stroke();
  }

  addNoise(ctx, 0.03);
  return makeTexture(canvas);
}

/**
 * Tile grid — square porcelain tiles with thin grout lines.
 * Used for kitchen floor (grey porcelain).
 */
function tileGrid(
  tileColor: string,
  groutColor: string,
  tileSize = 48,
): THREE.CanvasTexture {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d')!;
  const grout = 3; // px grout width

  ctx.fillStyle = groutColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (let row = 0; row * tileSize < SIZE; row++) {
    for (let col = 0; col * tileSize < SIZE; col++) {
      const x = col * tileSize + grout;
      const y = row * tileSize + grout;
      const w = tileSize - grout;
      const h = tileSize - grout;

      // Slight per-tile color variation
      const v = (Math.random() - 0.5) * 12;
      const c = hexToRgb(tileColor);
      ctx.fillStyle = `rgb(${clamp(c.r + v)},${clamp(c.g + v)},${clamp(c.b + v)})`;
      ctx.fillRect(x, y, w, h);

      // Subtle highlight on top-left edge
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x, y, 2, h);
    }
  }

  addNoise(ctx, 0.02);
  return makeTexture(canvas);
}

/**
 * Subway tile — rectangular tiles (2:1 ratio) in brick-bond pattern.
 * Used for bathroom walls.
 */
function tileSubway(
  tileColor: string,
  groutColor: string,
): THREE.CanvasTexture {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d')!;
  const tw = 64; // tile width px
  const th = 32; // tile height px
  const grout = 2;

  ctx.fillStyle = groutColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (let row = 0; row * th < SIZE + th; row++) {
    const offset = (row % 2) * (tw / 2); // brick bond offset
    for (let col = -1; col * tw < SIZE + tw; col++) {
      const x = col * tw + offset + grout;
      const y = row * th + grout;
      const w = tw - grout;
      const h = th - grout;

      const v = (Math.random() - 0.5) * 8;
      const c = hexToRgb(tileColor);
      ctx.fillStyle = `rgb(${clamp(c.r + v)},${clamp(c.g + v)},${clamp(c.b + v)})`;
      ctx.fillRect(x, y, w, h);

      // Gloss highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, y, w, 3);
    }
  }

  addNoise(ctx, 0.015);
  return makeTexture(canvas);
}

/**
 * Carpet — dense short-pile texture with subtle directional sheen.
 * Used for bedroom floor.
 */
function carpet(baseColor: string): THREE.CanvasTexture {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d')!;

  const c = hexToRgb(baseColor);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Pile rows — horizontal lines with slight variation
  for (let y = 0; y < SIZE; y += 2) {
    const alpha = 0.04 + Math.random() * 0.06;
    ctx.strokeStyle = `rgba(${clamp(c.r - 20)},${clamp(c.g - 20)},${clamp(c.b - 20)},${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SIZE, y);
    ctx.stroke();
  }

  addNoise(ctx, 0.06);
  return makeTexture(canvas);
}

/**
 * Concrete / cement — flat grey with aggregate speckle.
 * Used for living-room accent wall.
 */
function concrete(baseColor: string): THREE.CanvasTexture {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Aggregate speckle
  const c = hexToRgb(baseColor);
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * SIZE;
    const y = Math.random() * SIZE;
    const r = Math.random() * 1.5;
    const v = (Math.random() - 0.5) * 30;
    ctx.fillStyle = `rgba(${clamp(c.r + v)},${clamp(c.g + v)},${clamp(c.b + v)},0.4)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  addNoise(ctx, 0.04);
  return makeTexture(canvas);
}

/**
 * Plaster — smooth matte wall with very subtle texture.
 */
function plaster(baseColor: string): THREE.CanvasTexture {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Very subtle brush strokes
  const c = hexToRgb(baseColor);
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * SIZE;
    const y = Math.random() * SIZE;
    const len = 20 + Math.random() * 60;
    const angle = Math.random() * Math.PI;
    const v = (Math.random() - 0.5) * 10;
    ctx.strokeStyle = `rgba(${clamp(c.r + v)},${clamp(c.g + v)},${clamp(c.b + v)},0.15)`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  addNoise(ctx, 0.025);
  return makeTexture(canvas);
}

/**
 * Paint flat — nearly uniform color with minimal texture.
 */
function paintFlat(baseColor: string): THREE.CanvasTexture {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, SIZE, SIZE);
  addNoise(ctx, 0.015);
  return makeTexture(canvas);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 128, g: 128, b: 128 };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function makeFloorTexture(
  pattern: FloorPattern,
  color: string,
): THREE.CanvasTexture {
  switch (pattern) {
    case 'wood-parquet': return woodParquet();
    case 'tile-grid':    return tileGrid(color, '#9A9A9A');
    case 'carpet':       return carpet(color);
    case 'concrete':     return concrete(color);
  }
}

export function makeWallTexture(
  pattern: WallPattern,
  color: string,
): THREE.CanvasTexture {
  switch (pattern) {
    case 'plaster':     return plaster(color);
    case 'tile-subway': return tileSubway(color, '#C8C8C8');
    case 'paint-flat':  return paintFlat(color);
    case 'cement':      return concrete(color);
  }
}
