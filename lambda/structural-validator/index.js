/**
 * AWS Lambda function for furniture structural validation.
 *
 * Receives a LambdaRequest (assemblyGraph + material), evaluates each shelf node
 * for buckling risk based on free span between horizontal neighbors, and returns
 * a LambdaResponse with validation results.
 *
 * Units: millimetres (mm) throughout.
 * Must complete validation in < 5 seconds for designs with up to 50 Building Blocks.
 */

'use strict';

// ---------------------------------------------------------------------------
// Material specs — maximum free span before buckling risk
// ---------------------------------------------------------------------------

const MATERIAL_SPECS = {
  'melamine-18':   { maxSpanMm: 800  },
  'mdf-18':        { maxSpanMm: 700  },
  'solid-wood-20': { maxSpanMm: 1000 },
};

/** Tolerance in mm for considering two blocks to be on the same horizontal level */
const HORIZONTAL_TOLERANCE_MM = 50;

// ---------------------------------------------------------------------------
// Span validation logic (mirrors validateSpanLocally from the client)
// ---------------------------------------------------------------------------

/**
 * Calculates the free span for a shelf node between its nearest horizontal
 * neighbors and compares it against the material's maximum allowed span.
 *
 * @param {object} block - The shelf node to validate
 * @param {object[]} allNodes - All nodes in the assembly graph
 * @param {string} material - Material type key
 * @returns {{ spanMm: number, maxAllowedMm: number, exceeded: boolean } | null}
 *   null if no span issue detected, or an object describing the violation.
 */
function validateShelfSpan(block, allNodes, material) {
  const spec = MATERIAL_SPECS[material];
  if (!spec) {
    // Unknown material — skip validation for this block
    return null;
  }
  const maxSpanMm = spec.maxSpanMm;

  // Find horizontal neighbors: all other nodes on the same Y level (±tolerance)
  const horizontalNeighbors = allNodes.filter(
    (n) =>
      n.id !== block.id &&
      Math.abs(n.position.y - block.position.y) <= HORIZONTAL_TOLERANCE_MM,
  );

  if (horizontalNeighbors.length === 0) {
    return null; // No neighbors → no span to evaluate
  }

  // Split neighbors into left (lower X) and right (higher X) of the block centre
  const leftNeighbors = horizontalNeighbors.filter(
    (n) => n.position.x + n.size.x / 2 <= block.position.x,
  );
  const rightNeighbors = horizontalNeighbors.filter(
    (n) => n.position.x - n.size.x / 2 >= block.position.x,
  );

  let spanMm;

  if (leftNeighbors.length === 0 || rightNeighbors.length === 0) {
    // Only one side has a neighbor → span is the block's own width
    spanMm = block.size.x;
  } else {
    // Find the nearest neighbor on each side
    // Nearest left: the one whose right face is closest to the block's left face
    const nearestLeft = leftNeighbors.reduce((best, n) => {
      const rightFace = n.position.x + n.size.x / 2;
      const bestRightFace = best.position.x + best.size.x / 2;
      return rightFace > bestRightFace ? n : best;
    });

    // Nearest right: the one whose left face is closest to the block's right face
    const nearestRight = rightNeighbors.reduce((best, n) => {
      const leftFace = n.position.x - n.size.x / 2;
      const bestLeftFace = best.position.x - best.size.x / 2;
      return leftFace < bestLeftFace ? n : best;
    });

    const leftInnerFace  = nearestLeft.position.x  + nearestLeft.size.x  / 2;
    const rightInnerFace = nearestRight.position.x - nearestRight.size.x / 2;

    spanMm = rightInnerFace - leftInnerFace;
  }

  // Non-positive span → no issue
  if (spanMm <= 0) {
    return null;
  }

  // Only report when span strictly exceeds the material limit
  if (spanMm > maxSpanMm) {
    return { spanMm, maxAllowedMm: maxSpanMm, exceeded: true };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  const startTime = Date.now();

  try {
    // Support both API Gateway (event.body is a string) and direct invocation
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event;
    const { assemblyGraph, material } = body;

    if (!assemblyGraph || !assemblyGraph.nodes) {
      throw new Error('Missing or invalid assemblyGraph in request body');
    }

    if (!material) {
      throw new Error('Missing material in request body');
    }

    const nodes = assemblyGraph.nodes;

    if (!Array.isArray(nodes)) {
      throw new Error('assemblyGraph.nodes must be an array');
    }

    const alerts = [];

    // Evaluate each shelf node
    for (const node of nodes) {
      if (node.type !== 'shelf') {
        continue;
      }

      const result = validateShelfSpan(node, nodes, material);

      if (result && result.exceeded) {
        alerts.push({
          affectedPieceIds: [node.id],
          spanMm: result.spanMm,
          maxAllowedMm: result.maxAllowedMm,
          material,
          message: `Span of ${result.spanMm.toFixed(0)} mm exceeds the maximum allowed ${result.maxAllowedMm} mm for ${material}.`,
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        valid: alerts.length === 0,
        alerts,
        processingTimeMs: Date.now() - startTime,
      }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
