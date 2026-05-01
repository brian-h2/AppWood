/// <reference types="@types/webxr" />

/**
 * HitTestService — wraps the WebXR hit-test API.
 *
 * Requirements: 3.1, 3.2, 3.5, 3.6
 *
 * - initialize: requests a hit-test source from the XR session using the
 *   viewer reference space. If the `hit-test` feature is unavailable (e.g.
 *   the session was started without it), logs a warning and continues without
 *   throwing.
 * - getClosestHit: returns the first (closest to screen centre) hit-test
 *   result for the current frame, or null when no surfaces are detected.
 * - dispose: cancels the active hit-test source and releases the reference.
 */

export interface HitTestService {
  initialize(session: XRSession, viewerSpace: XRReferenceSpace): Promise<void>;
  getClosestHit(frame: XRFrame): XRHitTestResult | null;
  dispose(): void;
}

export class WebXRHitTestService implements HitTestService {
  private hitTestSource: XRHitTestSource | null = null;

  async initialize(session: XRSession, viewerSpace: XRReferenceSpace): Promise<void> {
    try {
      this.hitTestSource =
        (await session.requestHitTestSource({ space: viewerSpace })) ?? null;
    } catch (err) {
      console.warn('[HitTestService] hit-test feature not available:', err);
      this.hitTestSource = null;
    }
  }

  getClosestHit(frame: XRFrame): XRHitTestResult | null {
    if (!this.hitTestSource) return null;
    const results = frame.getHitTestResults(this.hitTestSource);
    if (!results || results.length === 0) return null;
    // WebXR returns results ordered by distance from the screen centre;
    // the first entry is always the closest.
    return results[0];
  }

  dispose(): void {
    if (this.hitTestSource) {
      this.hitTestSource.cancel();
      this.hitTestSource = null;
    }
  }
}

/** Factory function — returns a new `HitTestService` instance. */
export function createHitTestService(): HitTestService {
  return new WebXRHitTestService();
}
