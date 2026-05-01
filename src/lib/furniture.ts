// Motor paramétrico para una estantería simple (DoselCode Wood)
// Unidades: milímetros (mm) en el modelo de datos.
// El visor 3D escala mm -> metros (factor 0.001).

export type ShelfParams = {
  width: number;      // mm exterior
  height: number;     // mm exterior
  depth: number;      // mm exterior
  thickness: number;  // mm grosor del tablero
  shelves: number;    // número de entrepaños internos
  hasBack: boolean;   // panel trasero
};

export type Piece = {
  id: string;
  name: string;
  // Dimensiones de fabricación (mm). length x width x thickness
  length: number;
  width: number;
  thickness: number;
  qty: number;
  // Pose en el modelo (mm), centro de la pieza
  position: [number, number, number];
  size: [number, number, number]; // x, y, z en mm
};

export const DEFAULT_PARAMS: ShelfParams = {
  width: 800,
  height: 1800,
  depth: 320,
  thickness: 18,
  shelves: 4,
  hasBack: true,
};

export function buildShelf(p: ShelfParams): Piece[] {
  const t = p.thickness;
  const W = p.width;
  const H = p.height;
  const D = p.depth;

  const innerW = W - 2 * t;
  const innerH = H - 2 * t;
  const backThickness = 6; // panel trasero más fino (típico)

  const pieces: Piece[] = [];

  // Lateral izquierdo
  pieces.push({
    id: "side-l",
    name: "Lateral izquierdo",
    length: H,
    width: D,
    thickness: t,
    qty: 1,
    size: [t, H, D],
    position: [-(W - t) / 2, 0, 0],
  });

  // Lateral derecho
  pieces.push({
    id: "side-r",
    name: "Lateral derecho",
    length: H,
    width: D,
    thickness: t,
    qty: 1,
    size: [t, H, D],
    position: [(W - t) / 2, 0, 0],
  });

  // Techo
  pieces.push({
    id: "top",
    name: "Techo",
    length: innerW,
    width: D,
    thickness: t,
    qty: 1,
    size: [innerW, t, D],
    position: [0, (H - t) / 2, 0],
  });

  // Base
  pieces.push({
    id: "bottom",
    name: "Base",
    length: innerW,
    width: D,
    thickness: t,
    qty: 1,
    size: [innerW, t, D],
    position: [0, -(H - t) / 2, 0],
  });

  // Estantes internos, repartidos uniformemente
  if (p.shelves > 0 && innerH > t * (p.shelves + 1)) {
    const slot = innerH / (p.shelves + 1);
    for (let i = 1; i <= p.shelves; i++) {
      const yCenter = -H / 2 + t + slot * i - t / 2;
      pieces.push({
        id: `shelf-${i}`,
        name: `Entrepaño ${i}`,
        length: innerW,
        width: D - (p.hasBack ? backThickness : 0),
        thickness: t,
        qty: 1,
        size: [innerW, t, D - (p.hasBack ? backThickness : 0)],
        position: [0, yCenter, p.hasBack ? backThickness / 2 : 0],
      });
    }
  }

  // Panel trasero
  if (p.hasBack) {
    pieces.push({
      id: "back",
      name: "Panel trasero",
      length: W,
      width: H,
      thickness: backThickness,
      qty: 1,
      size: [W, H, backThickness],
      position: [0, 0, -(D / 2) + backThickness / 2],
    });
  }

  return pieces;
}

// Lista agregada para mostrar (agrupa piezas idénticas)
export type CutItem = {
  name: string;
  length: number;
  width: number;
  thickness: number;
  qty: number;
};

export function aggregateCutList(pieces: Piece[]): CutItem[] {
  const map = new Map<string, CutItem>();
  for (const p of pieces) {
    // Clave por dimensiones + grosor (orientación normalizada)
    const L = Math.max(p.length, p.width);
    const Wd = Math.min(p.length, p.width);
    const key = `${L}x${Wd}x${p.thickness}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += p.qty;
      existing.name = existing.name.includes(p.name) ? existing.name : `${existing.name}, ${p.name}`;
    } else {
      map.set(key, { name: p.name, length: L, width: Wd, thickness: p.thickness, qty: p.qty });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.length * b.width - a.length * a.width);
}
