// Optimización 2D simple — algoritmo "shelf / next-fit decreasing height"
// Suficiente para un MVP: organiza piezas en placas estándar.
import type { CutItem } from "./furniture";
import type { NestingConfig } from "./types";

export type SheetSize = { width: number; height: number; name: string };

export const STANDARD_SHEETS: SheetSize[] = [
  { name: "Melamina 2440 × 1830", width: 2440, height: 1830 },
  { name: "MDF 2440 × 1220", width: 2440, height: 1220 },
];

/**
 * Extends CutItem with an optional grain direction constraint.
 * When grainDirection !== 'none', the piece must NOT be rotated 90° during nesting optimisation.
 */
export type NestingItem = CutItem & {
  grainDirection?: 'horizontal' | 'vertical' | 'none';
};

export type PlacedRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** True when the piece could not be placed due to grain direction constraints */
  unplaceable?: boolean;
};

export type NestedSheet = {
  sheet: SheetSize;
  rects: PlacedRect[];
  usedArea: number;
};

const DEFAULT_KERF_MM = 3.2;

export function nestPieces(items: NestingItem[], nestingConfig: NestingConfig): NestedSheet[] {
  // Validate and resolve saw kerf
  let kerf: number;
  if (nestingConfig.sawKerfMm <= 0) {
    console.warn(
      `nestPieces: sawKerfMm must be > 0 (got ${nestingConfig.sawKerfMm}). Using default ${DEFAULT_KERF_MM} mm.`
    );
    kerf = DEFAULT_KERF_MM;
  } else {
    kerf = nestingConfig.sawKerfMm;
  }

  const sheet = nestingConfig.sheet;

  // Expand quantities, annotate with grain direction, sort by height descending
  const rects = items
    .flatMap((it) =>
      Array.from({ length: it.qty }, (_, i) => ({
        w: Math.max(it.length, it.width),
        h: Math.min(it.length, it.width),
        label: `${it.name}${it.qty > 1 ? ` #${i + 1}` : ""}`,
        grainDirection: it.grainDirection,
      })),
    )
    .sort((a, b) => b.h - a.h);

  const sheets: NestedSheet[] = [];

  let current: NestedSheet | null = null;
  let cursorX = 0;
  let shelfY = 0;
  let shelfH = 0;

  const newSheet = () => {
    current = { sheet, rects: [], usedArea: 0 };
    sheets.push(current);
    cursorX = 0;
    shelfY = 0;
    shelfH = 0;
  };

  for (const r of rects) {
    const hasGrainConstraint = r.grainDirection !== undefined && r.grainDirection !== 'none';

    const fitsNormal = r.w <= sheet.width && r.h <= sheet.height;
    const fitsRot = r.h <= sheet.width && r.w <= sheet.height;

    if (hasGrainConstraint) {
      // Grain-constrained pieces cannot be rotated
      if (!fitsNormal) {
        // Piece doesn't fit without rotation — mark as unplaceable and skip
        if (!current) newSheet();
        current!.rects.push({
          x: 0,
          y: 0,
          w: r.w,
          h: r.h,
          label: r.label,
          unplaceable: true,
        });
        continue;
      }
      // Place without rotation
      const w = r.w;
      const h = r.h;

      if (!current) newSheet();

      if (cursorX + w > sheet.width) {
        shelfY += shelfH + kerf;
        cursorX = 0;
        shelfH = 0;
      }
      if (shelfY + h > sheet.height) {
        newSheet();
      }

      current!.rects.push({ x: cursorX, y: shelfY, w, h, label: r.label });
      current!.usedArea += w * h;
      cursorX += w + kerf;
      if (h > shelfH) shelfH = h;
    } else {
      // No grain constraint — allow rotation if needed (original behaviour)
      if (!fitsNormal && !fitsRot) continue;

      let w = r.w;
      let h = r.h;
      if (!fitsNormal && fitsRot) {
        w = r.h;
        h = r.w;
      }

      if (!current) newSheet();

      if (cursorX + w > sheet.width) {
        shelfY += shelfH + kerf;
        cursorX = 0;
        shelfH = 0;
      }
      if (shelfY + h > sheet.height) {
        newSheet();
      }

      current!.rects.push({ x: cursorX, y: shelfY, w, h, label: r.label });
      current!.usedArea += w * h;
      cursorX += w + kerf;
      if (h > shelfH) shelfH = h;
    }
  }

  return sheets;
}
