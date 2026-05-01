/**
 * StructuralValidator — validates furniture assembly graphs for structural integrity.
 *
 * Two entry points:
 *   - `validate`           async, calls AWS Lambda via HTTP POST; falls back to client-side on error
 *   - `validateSpanLocally` sync, no network call; evaluates a single shelf block's free span
 *
 * Units: millimetres (mm) throughout.
 * No Three.js dependency.
 */

import type {
  AssemblyGraph,
  BuildingBlock,
  MaterialType,
  ValidationResult,
  ValidationAlert,
  SpanValidationResult,
  LambdaRequest,
  LambdaResponse,
} from '../types';
import { MATERIAL_SPECS, VALIDATION_COLORS } from '../types';
import { serialize } from '../snap/assemblyGraph';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tolerance in mm for considering two blocks to be on the same horizontal level */
const HORIZONTAL_LEVEL_TOLERANCE_MM = 50;

// ---------------------------------------------------------------------------
// validateSpanLocally
// ---------------------------------------------------------------------------

/**
 * Calculates the free span for a shelf block between its nearest horizontal
 * neighbors and compares it against the material's maximum allowed span.
 *
 * Span calculation:
 *   - Neighbors are blocks on the same Y level (±50 mm tolerance)
 *   - Span = distance between the inner faces of the two nearest neighbors on the X axis
 *   - If only one neighbor: span = block.size.x (the block's own width)
 *   - If no neighbors: span = 0, returns status 'ok'
 *
 * Side effect: updates `block.visualValidationStatus` in place.
 */
export function validateSpanLocally(
  block: BuildingBlock,
  neighbors: BuildingBlock[],
  material: MaterialType,
): SpanValidationResult {
  const spec = MATERIAL_SPECS[material];
  const maxSpanMm = spec.maxSpanMm;

  // No neighbors → no span to evaluate
  if (neighbors.length === 0) {
    block.visualValidationStatus = 'ok';
    return { status: 'ok', spanMm: 0, maxAllowedMm: maxSpanMm };
  }

  // Filter to horizontal neighbors (same Y level ±tolerance)
  const horizontalNeighbors = neighbors.filter(
    (n) => Math.abs(n.position.y - block.position.y) <= HORIZONTAL_LEVEL_TOLERANCE_MM,
  );

  if (horizontalNeighbors.length === 0) {
    block.visualValidationStatus = 'ok';
    return { status: 'ok', spanMm: 0, maxAllowedMm: maxSpanMm };
  }

  // Split neighbors into left (lower X) and right (higher X) of the block
  const blockLeft = block.position.x - block.size.x / 2;
  const blockRight = block.position.x + block.size.x / 2;

  const leftNeighbors = horizontalNeighbors.filter(
    (n) => n.position.x + n.size.x / 2 <= block.position.x,
  );
  const rightNeighbors = horizontalNeighbors.filter(
    (n) => n.position.x - n.size.x / 2 >= block.position.x,
  );

  let spanMm: number;

  if (leftNeighbors.length === 0 || rightNeighbors.length === 0) {
    // Only one side has a neighbor → span is the block's own width
    spanMm = block.size.x;
  } else {
    // Find the nearest neighbor on each side
    // Nearest left neighbor: the one whose right face is closest to the block's left face
    const nearestLeft = leftNeighbors.reduce((best, n) => {
      const rightFace = n.position.x + n.size.x / 2;
      const bestRightFace = best.position.x + best.size.x / 2;
      return rightFace > bestRightFace ? n : best;
    });

    // Nearest right neighbor: the one whose left face is closest to the block's right face
    const nearestRight = rightNeighbors.reduce((best, n) => {
      const leftFace = n.position.x - n.size.x / 2;
      const bestLeftFace = best.position.x - best.size.x / 2;
      return leftFace < bestLeftFace ? n : best;
    });

    const leftInnerFace = nearestLeft.position.x + nearestLeft.size.x / 2;
    const rightInnerFace = nearestRight.position.x - nearestRight.size.x / 2;

    spanMm = rightInnerFace - leftInnerFace;
  }

  // If span is non-positive, treat as no span
  if (spanMm <= 0) {
    block.visualValidationStatus = 'ok';
    return { status: 'ok', spanMm: 0, maxAllowedMm: maxSpanMm };
  }

  // Determine status
  let status: SpanValidationResult['status'];
  if (spanMm > maxSpanMm) {
    status = 'error';
  } else if (spanMm > maxSpanMm * 0.9) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  // Apply visual validation status (VALIDATION_COLORS maps status → color,
  // but the status string itself is stored on the block for Three.js to consume)
  block.visualValidationStatus = status;

  return { status, spanMm, maxAllowedMm: maxSpanMm };
}

// ---------------------------------------------------------------------------
// Client-side fallback
// ---------------------------------------------------------------------------

/**
 * Runs a simplified structural validation entirely on the client.
 * Iterates all shelf nodes in the graph, finds their horizontal neighbors,
 * and calls `validateSpanLocally` for each.
 */
function runClientFallback(
  graph: AssemblyGraph,
  material: MaterialType,
): ValidationResult {
  const alerts: ValidationAlert[] = [];
  const allBlocks = Array.from(graph.nodes.values());

  for (const block of allBlocks) {
    if (block.type !== 'shelf') {
      continue;
    }

    // Find horizontal neighbors: blocks on the same Y level (±tolerance)
    const neighbors = allBlocks.filter(
      (n) =>
        n.id !== block.id &&
        Math.abs(n.position.y - block.position.y) <= HORIZONTAL_LEVEL_TOLERANCE_MM,
    );

    const result = validateSpanLocally(block, neighbors, material);

    if (result.status !== 'ok') {
      const spec = MATERIAL_SPECS[material];
      alerts.push({
        affectedPieceIds: [block.id],
        spanMm: result.spanMm,
        maxAllowedMm: spec.maxSpanMm,
        material,
        message:
          result.status === 'error'
            ? `Span of ${result.spanMm.toFixed(0)} mm exceeds the maximum allowed ${spec.maxSpanMm} mm for ${material}.`
            : `Span of ${result.spanMm.toFixed(0)} mm is approaching the maximum allowed ${spec.maxSpanMm} mm for ${material} (warning threshold: ${(spec.maxSpanMm * 0.9).toFixed(0)} mm).`,
      });
    }
  }

  return {
    valid: alerts.length === 0,
    alerts,
    source: 'client-fallback',
  };
}

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

/**
 * Validates the assembly graph by sending it to the AWS Lambda function.
 *
 * On success: returns `ValidationResult` with `source: 'lambda'`.
 * On any error (network failure, timeout, 5xx, malformed response):
 *   falls back to `runClientFallback` and returns `source: 'client-fallback'`.
 *
 * The Lambda URL is read from `import.meta.env.VITE_LAMBDA_URL`.
 * A default saw kerf of 3.2 mm is used when serialising the graph.
 */
export async function validate(
  graph: AssemblyGraph,
  material: MaterialType,
): Promise<ValidationResult> {
  const lambdaUrl: string | undefined = import.meta.env.VITE_LAMBDA_URL;

  if (!lambdaUrl) {
    // No Lambda URL configured — use client fallback immediately
    return runClientFallback(graph, material);
  }

  const payload: LambdaRequest = {
    assemblyGraph: serialize(graph, 3.2),
    material,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Treat any non-2xx response as an error → fallback
    if (!response.ok) {
      return runClientFallback(graph, material);
    }

    let lambdaResponse: LambdaResponse;
    try {
      lambdaResponse = (await response.json()) as LambdaResponse;
    } catch {
      // Malformed JSON → fallback
      return runClientFallback(graph, material);
    }

    // Validate the shape of the response
    if (
      typeof lambdaResponse.valid !== 'boolean' ||
      !Array.isArray(lambdaResponse.alerts)
    ) {
      return runClientFallback(graph, material);
    }

    return {
      valid: lambdaResponse.valid,
      alerts: lambdaResponse.alerts,
      source: 'lambda',
    };
  } catch {
    // Network error, abort (timeout), or any other exception → fallback
    return runClientFallback(graph, material);
  }
}

// Re-export VALIDATION_COLORS for consumers that need to apply colours
export { VALIDATION_COLORS };
