/**
 * Cut list generation with edge banding (tapacanto) compensation.
 *
 * For each BuildingBlock, the nominal dimensions come directly from block.size:
 *   - nominalLengthMm = block.size.x  (horizontal span, X axis)
 *   - nominalWidthMm  = block.size.z  (depth, Z axis)
 *   - thicknessMm     = block.size.y  (board thickness, Y axis)
 *
 * Edge banding face → affected cut dimension mapping:
 *   - 'left'  (X-) → length  (X axis)
 *   - 'right' (X+) → length  (X axis)
 *   - 'front' (Z+) → width   (Z axis)
 *   - 'back'  (Z-) → width   (Z axis)
 *   - 'top'   (Y+) → no cut dimension effect (thickness face)
 *   - 'bottom'(Y-) → no cut dimension effect (thickness face)
 *
 * The Viewer3D always renders with nominal dimensions; the edge banding
 * discount only exists in CutListItem and in the payload sent to the saw.
 *
 * Requirements: Punto 1 — Compensación de Tapacantos
 */

import type {
  BuildingBlock,
  CutListItem,
  EdgeBandingCorrection,
  FaceName,
  NestingConfig,
} from './types';

/** Maps each face to the cut dimension it affects, or null for thickness faces. */
const FACE_DIMENSION_MAP: Record<FaceName, 'length' | 'width' | null> = {
  left:   'length',
  right:  'length',
  front:  'width',
  back:   'width',
  top:    null,
  bottom: null,
};

/**
 * Generates a cut list from an array of BuildingBlocks, applying edge banding
 * (tapacanto) compensation to produce the actual cut dimensions.
 *
 * Blocks with invalid edge banding (thickness > affected nominal dimension)
 * are excluded from the result and a warning is logged.
 *
 * @param blocks        Array of BuildingBlocks to process.
 * @param nestingConfig Accepted for future use (e.g. passing to nesting);
 *                      not used in the core edge banding calculation.
 * @returns             Array of CutListItem, one per valid block.
 */
export function generateCutList(
  blocks: BuildingBlock[],
  nestingConfig: NestingConfig, // eslint-disable-line @typescript-eslint/no-unused-vars
): CutListItem[] {
  const result: CutListItem[] = [];

  for (const block of blocks) {
    const nominalLengthMm = block.size.x;
    const nominalWidthMm  = block.size.z;
    const thicknessMm     = block.size.y;

    const corrections: EdgeBandingCorrection[] = [];
    let valid = true;

    // Build corrections for each configured face
    for (const [faceName, faceConfig] of Object.entries(block.edgeBanding.faces)) {
      const face = faceName as FaceName;
      const affectedDimension = FACE_DIMENSION_MAP[face];

      // 'top' and 'bottom' faces don't affect cut dimensions — skip
      if (affectedDimension === null) {
        continue;
      }

      const nominalForDimension =
        affectedDimension === 'length' ? nominalLengthMm : nominalWidthMm;

      // Validation: edge banding thickness must not exceed the nominal dimension
      if (faceConfig.thicknessMm > nominalForDimension) {
        console.warn(
          `[generateCutList] Block "${block.id}" (${block.type}): ` +
          `edge banding on face "${face}" has thicknessMm=${faceConfig.thicknessMm} ` +
          `which exceeds the nominal ${affectedDimension} of ${nominalForDimension} mm. ` +
          `Block excluded from cut list.`,
        );
        valid = false;
        break;
      }

      corrections.push({
        face,
        thicknessMm:       faceConfig.thicknessMm,
        affectedDimension,
        correctionMm:      faceConfig.thicknessMm,
      });
    }

    if (!valid) {
      continue;
    }

    // Sum corrections per dimension
    const lengthCorrection = corrections
      .filter(c => c.affectedDimension === 'length')
      .reduce((sum, c) => sum + c.correctionMm, 0);

    const widthCorrection = corrections
      .filter(c => c.affectedDimension === 'width')
      .reduce((sum, c) => sum + c.correctionMm, 0);

    const cutLengthMm = nominalLengthMm - lengthCorrection;
    const cutWidthMm  = nominalWidthMm  - widthCorrection;

    result.push({
      blockId:               block.id,
      name:                  `${block.type}-${block.id.slice(0, 6)}`,
      nominalLengthMm,
      nominalWidthMm,
      thicknessMm,
      qty:                   1,
      cutLengthMm,
      cutWidthMm,
      edgeBandingCorrections: corrections,
    });
  }

  return result;
}
