/// <reference types="@types/webxr" />
/**
 * ARViewer.tsx
 *
 * React component that manages the full WebXR AR session lifecycle.
 *
 * Tasks implemented:
 *   12.1 - WebXR support detection and "Ver en tu espacio" button
 *   12.2 - WebXR session lifecycle management
 *   12.3 - Reticle and FurnitureModel placement with Anchor
 *   12.4 - DOM Overlay and light estimation
 *
 * Requirements: 1.1-1.5, 2.1-2.6, 3.1-3.6, 4.1-4.6, 5.1-5.6, 6.1-6.5, 7.3-7.5, 8.1-8.4
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Grid } from "@react-three/drei";
import type { FurnitureModel } from "@/lib/types";
import { createHitTestService } from "@/lib/ar/hitTestService";
import type { HitTestService } from "@/lib/ar/hitTestService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ARViewerProps {
  furnitureModel: FurnitureModel;
  onExit: () => void;
}

type SupportStatus = "checking" | "supported" | "unsupported" | "no-webxr" | "no-https" | "desktop";
type SessionStatus = "idle" | "active" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns overall bounding box of the furniture model in mm. */
function getFurnitureDimensions(model: FurnitureModel): { w: number; h: number; d: number } {
  if (model.designMode === "blocks" && model.blocks.length > 0) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const b of model.blocks) {
      minX = Math.min(minX, b.position.x - b.size.x / 2);
      maxX = Math.max(maxX, b.position.x + b.size.x / 2);
      minY = Math.min(minY, b.position.y - b.size.y / 2);
      maxY = Math.max(maxY, b.position.y + b.size.y / 2);
      minZ = Math.min(minZ, b.position.z - b.size.z / 2);
      maxZ = Math.max(maxZ, b.position.z + b.size.z / 2);
    }
    return { w: maxX - minX, h: maxY - minY, d: maxZ - minZ };
  }
  // Parametric mode
  const p = model.params;
  return { w: p.width, h: p.height, d: p.depth };
}

/** Builds a Three.js Group representing the furniture model (MVP: single box). */
function buildFurnitureGroup(model: FurnitureModel): THREE.Group {
  const group = new THREE.Group();
  const MM = 0.001;

  if (model.designMode === "blocks" && model.blocks.length > 0) {
    for (const block of model.blocks) {
      const geo = new THREE.BoxGeometry(
        block.size.x * MM,
        block.size.y * MM,
        block.size.z * MM
      );
      const mat = new THREE.MeshStandardMaterial({ color: 0xc8a96e, roughness: 0.65, metalness: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(block.position.x * MM, block.position.y * MM, block.position.z * MM);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  } else {
    // Parametric mode  render as single box
    const dims = getFurnitureDimensions(model);
    const geo = new THREE.BoxGeometry(dims.w * MM, dims.h * MM, dims.d * MM);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc8a96e, roughness: 0.65, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    // Lift so base sits at y=0
    mesh.position.set(0, (dims.h / 2) * MM, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

/** Creates the reticle mesh: flat semi-transparent ring, 0.3 m diameter. */
function createReticleMesh(): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.12, 0.15, 32);
  // Rotate so it lies flat on the XZ plane
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
  return new THREE.Mesh(geo, mat);
}


// ---------------------------------------------------------------------------
// Fallback 3D view (when AR is not supported)
// ---------------------------------------------------------------------------

function FallbackViewer3D({ model }: { model: FurnitureModel }) {
  const dims = getFurnitureDimensions(model);
  const MM = 0.001;
  const yOffset = (dims.h / 2) * MM;

  return (
    <Canvas
      shadows
      camera={{ position: [2.4, 1.6, 2.6], fov: 35 }}
      className="!h-full !w-full"
    >
      <color attach="background" args={["#efe7da"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} castShadow />
      <mesh position={[0, yOffset, 0]} castShadow receiveShadow>
        <boxGeometry args={[dims.w * MM, dims.h * MM, dims.d * MM]} />
        <meshStandardMaterial color={0xc8a96e} roughness={0.65} metalness={0.05} />
      </mesh>
      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={8} blur={2.4} far={4} />
      <Grid
        position={[0, 0.001, 0]}
        args={[20, 20]}
        cellSize={0.1}
        cellThickness={0.6}
        sectionSize={1}
        sectionThickness={1.2}
        sectionColor="#7a5a3a"
        cellColor="#b8a489"
        fadeDistance={10}
        fadeStrength={1.5}
        infiniteGrid
      />
      <Environment preset="apartment" />
      <OrbitControls target={[0, yOffset, 0]} enableDamping minDistance={1.2} maxDistance={8} maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  );
}


// ---------------------------------------------------------------------------
// Main ARViewer component
// ---------------------------------------------------------------------------

export function ARViewer({ furnitureModel, onExit }: ARViewerProps) {
  // --- Task 12.1: Support detection state ---
  const [supportStatus, setSupportStatus] = useState<SupportStatus>("checking");
  // --- Task 12.2: Session state ---
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [sessionError, setSessionError] = useState<string | null>(null);
  // --- Task 12.3: Reticle / placement state ---
  const [reticleVisible, setReticleVisible] = useState(false);
  const [modelPlaced, setModelPlaced] = useState(false);
  // --- Task 12.4: Rotation state ---
  const [rotationY, setRotationY] = useState(0);

  // Three.js refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const standardRafRef = useRef<number | null>(null);

  // XR refs
  const xrSessionRef = useRef<XRSession | null>(null);
  const hitTestServiceRef = useRef<HitTestService | null>(null);
  const anchorRef = useRef<XRAnchor | null>(null);
  const reticleMeshRef = useRef<THREE.Mesh | null>(null);
  const furnitureGroupRef = useRef<THREE.Group | null>(null);
  const localFloorSpaceRef = useRef<XRReferenceSpace | null>(null);
  const viewerSpaceRef = useRef<XRReferenceSpace | null>(null);

  // Light refs
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);

  // DOM overlay ref
  const overlayRef = useRef<HTMLDivElement>(null);

  // Stable ref to rotationY so XR loop can read it without stale closure
  const rotationYRef = useRef(0);
  useEffect(() => { rotationYRef.current = rotationY; }, [rotationY]);

  // Stable ref to modelPlaced
  const modelPlacedRef = useRef(false);
  useEffect(() => { modelPlacedRef.current = modelPlaced; }, [modelPlaced]);

  // Stable ref to reticleVisible
  const reticleVisibleRef = useRef(false);
  useEffect(() => { reticleVisibleRef.current = reticleVisible; }, [reticleVisible]);

  // ---------------------------------------------------------------------------
  // Task 12.1: Detect WebXR support on mount (non-blocking)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Check HTTPS context (requirement 7.3, 7.4)
    const isSecure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecure) {
      setSupportStatus("no-https");
      return;
    }

    // Check navigator.xr existence (requirement 1.2)
    if (!navigator.xr) {
      setSupportStatus("no-webxr");
      return;
    }

    // Async check without blocking render (requirement 1.5)
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then((supported) => {
        if (supported) {
          setSupportStatus("supported");
        } else {
          // Desktop or no rear camera (requirement 7.5)
          setSupportStatus("desktop");
        }
      })
      .catch(() => {
        setSupportStatus("unsupported");
      });
  }, []);

  // ---------------------------------------------------------------------------
  // Task 12.2: Initialize Three.js renderer (once, on mount)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,          // transparent background for AR (requirement 5.6)
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.xr.enabled = true;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    camera.position.set(0, 1.6, 3);
    cameraRef.current = camera;

    // Default lighting (requirement 5.5)
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    ambientLightRef.current = ambient;

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 3, 2);
    dirLight.castShadow = true;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // Reticle mesh (requirement 3.3)
    const reticle = createReticleMesh();
    reticle.visible = false;
    scene.add(reticle);
    reticleMeshRef.current = reticle;

    // Furniture group
    const furnitureGroup = buildFurnitureGroup(furnitureModel);
    furnitureGroup.visible = false;
    scene.add(furnitureGroup);
    furnitureGroupRef.current = furnitureGroup;

    // Standard render loop (suspended during XR session  requirement 8.4)
    let rafId: number;
    const renderLoop = () => {
      rafId = requestAnimationFrame(renderLoop);
      if (!rendererRef.current?.xr.isPresenting) {
        renderer.render(scene, camera);
      }
    };
    rafId = requestAnimationFrame(renderLoop);
    standardRafRef.current = rafId;

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ---------------------------------------------------------------------------
  // Task 12.2: Start AR session
  // ---------------------------------------------------------------------------
  const startARSession = useCallback(async () => {
    if (!navigator.xr) return;
    const renderer = rendererRef.current;
    if (!renderer) return;

    try {
      // Requirement 2.1: request session with required and optional features
      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay", "light-estimation", "anchors"],
        domOverlay: overlayRef.current ? { root: overlayRef.current } : undefined,
      });

      xrSessionRef.current = session;

      // Requirement 2.3: configure renderer for XR
      renderer.setClearColor(0x000000, 0); // transparent (requirement 5.6)
      await renderer.xr.setSession(session);

      setSessionStatus("active");
      setModelPlaced(false);
      modelPlacedRef.current = false;
      setReticleVisible(false);
      reticleVisibleRef.current = false;

      // Reset furniture group visibility
      if (furnitureGroupRef.current) {
        furnitureGroupRef.current.visible = false;
      }

      // Request reference spaces
      const viewerSpace = await session.requestReferenceSpace("viewer") as XRReferenceSpace;
      viewerSpaceRef.current = viewerSpace;

      const localFloorSpace = await session.requestReferenceSpace("local-floor").catch(
        () => session.requestReferenceSpace("local")
      ) as XRReferenceSpace;
      localFloorSpaceRef.current = localFloorSpace;

      // Initialize hit-test service (requirement 3.1)
      const hitTestService = createHitTestService();
      await hitTestService.initialize(session, viewerSpace);
      hitTestServiceRef.current = hitTestService;

      // Requirement 2.6: listen for sessionend to restore standard renderer
      session.addEventListener("sessionend", () => {
        handleSessionEnd();
      });

      // Requirement 2.4: run render loop via session.requestAnimationFrame
      const xrRenderLoop = (time: number, frame: XRFrame) => {
        session.requestAnimationFrame(xrRenderLoop);
        onXRFrame(time, frame);
      };
      session.requestAnimationFrame(xrRenderLoop);

    } catch (err) {
      const error = err as DOMException;
      if (error.name === "NotAllowedError") {
        // Requirement 2.2: camera permission denied
        setSessionError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara para usar AR.");
      } else {
        setSessionError(`Error al iniciar AR: ${error.message || "Error desconocido"}`);
      }
      setSessionStatus("error");
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Task 12.2: Handle session end (restore standard renderer)
  // ---------------------------------------------------------------------------
  const handleSessionEnd = useCallback(() => {
    // Requirement 2.5 / 2.6: restore renderer and preserve design state
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setClearColor(0x000000, 0);
      renderer.xr.enabled = true; // keep enabled but session is gone
    }

    // Dispose hit-test service
    if (hitTestServiceRef.current) {
      hitTestServiceRef.current.dispose();
      hitTestServiceRef.current = null;
    }

    // Release anchor
    anchorRef.current = null;

    // Hide AR objects
    if (reticleMeshRef.current) reticleMeshRef.current.visible = false;
    if (furnitureGroupRef.current) furnitureGroupRef.current.visible = false;

    xrSessionRef.current = null;
    localFloorSpaceRef.current = null;
    viewerSpaceRef.current = null;

    setSessionStatus("idle");
    setSessionError(null);
    setReticleVisible(false);
    setModelPlaced(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Task 12.2: Exit AR session
  // ---------------------------------------------------------------------------
  const exitARSession = useCallback(async () => {
    const session = xrSessionRef.current;
    if (session) {
      try {
        await session.end();
      } catch {
        // session may already be ended
        handleSessionEnd();
      }
    }
  }, [handleSessionEnd]);


  // ---------------------------------------------------------------------------
  // Task 12.3 + 12.4: XR frame loop
  // ---------------------------------------------------------------------------
  const onXRFrame = useCallback((
    _time: number,
    frame: XRFrame
  ) => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const session = xrSessionRef.current;
    const localFloorSpace = localFloorSpaceRef.current;
    const hitTestService = hitTestServiceRef.current;
    const reticleMesh = reticleMeshRef.current;
    const furnitureGroup = furnitureGroupRef.current;

    if (!renderer || !scene || !session || !localFloorSpace) return;

    // --- Task 12.4: Light estimation (requirement 5.4) ---
    try {
      // @ts-expect-error XRLightEstimate may not be in all type defs
      const lightProbe = frame.getLightEstimate?.(session.requestLightProbe?.());
      if (lightProbe) {
        const estimate = lightProbe as { sphericalHarmonicsCoefficients?: Float32Array; primaryLightIntensity?: { x: number; y: number; z: number }; primaryLightDirection?: { x: number; y: number; z: number } };
        if (ambientLightRef.current && estimate.sphericalHarmonicsCoefficients) {
          // Use first SH coefficient as ambient intensity approximation
          const sh = estimate.sphericalHarmonicsCoefficients;
          const intensity = Math.sqrt(sh[0] * sh[0] + sh[1] * sh[1] + sh[2] * sh[2]);
          ambientLightRef.current.intensity = Math.max(0.1, Math.min(2.0, intensity));
        }
        if (dirLightRef.current && estimate.primaryLightIntensity) {
          const li = estimate.primaryLightIntensity;
          dirLightRef.current.intensity = Math.max(0.1, Math.min(3.0, (li.x + li.y + li.z) / 3));
        }
        if (dirLightRef.current && estimate.primaryLightDirection) {
          const ld = estimate.primaryLightDirection;
          dirLightRef.current.position.set(ld.x, ld.y, ld.z);
        }
      }
    } catch {
      // Light estimation not available  defaults already set (requirement 5.5)
    }

    // --- Task 12.3: Update anchor pose each frame (requirement 4.3) ---
    if (anchorRef.current && furnitureGroup && modelPlacedRef.current) {
      try {
        const anchorPose = frame.getPose(anchorRef.current.anchorSpace, localFloorSpace);
        if (anchorPose) {
          const m = anchorPose.transform.matrix;
          furnitureGroup.matrix.fromArray(m);
          furnitureGroup.matrix.decompose(
            furnitureGroup.position,
            furnitureGroup.quaternion,
            furnitureGroup.scale
          );
          // Apply Y rotation from user controls
          furnitureGroup.rotation.y = rotationYRef.current * (Math.PI / 180);
        }
      } catch {
        // anchor may have been deleted
      }
    }

    // --- Task 12.3: Hit-test and reticle update (requirement 3.2, 3.5) ---
    if (hitTestService && reticleMesh) {
      const hit = hitTestService.getClosestHit(frame);
      if (hit) {
        const hitPose = hit.getPose(localFloorSpace);
        if (hitPose) {
          reticleMesh.visible = true;
          reticleMesh.matrix.fromArray(hitPose.transform.matrix);
          reticleMesh.matrix.decompose(
            reticleMesh.position,
            reticleMesh.quaternion,
            reticleMesh.scale
          );
          if (!reticleVisibleRef.current) {
            setReticleVisible(true);
            reticleVisibleRef.current = true;
          }
        }
      } else {
        reticleMesh.visible = false;
        if (reticleVisibleRef.current) {
          setReticleVisible(false);
          reticleVisibleRef.current = false;
        }
      }
    }

    // Render the scene using XR camera
    renderer.render(scene, renderer.xr.getCamera());
  }, []);


  // ---------------------------------------------------------------------------
  // Task 12.3: Handle screen tap to place / reposition furniture
  // ---------------------------------------------------------------------------
  const handleScreenTap = useCallback(async () => {
    const session = xrSessionRef.current;
    const reticleMesh = reticleMeshRef.current;
    const furnitureGroup = furnitureGroupRef.current;
    const localFloorSpace = localFloorSpaceRef.current;
    const hitTestService = hitTestServiceRef.current;

    if (!session || !reticleMesh || !reticleMesh.visible || !furnitureGroup || !localFloorSpace) return;

    // Delete previous anchor if repositioning (requirement 4.5)
    if (anchorRef.current) {
      try {
        anchorRef.current.delete?.();
      } catch {
        // ignore
      }
      anchorRef.current = null;
    }

    // Get the current hit result to create anchor
    // We use the reticle's current world transform as the anchor pose
    const reticlePosition = reticleMesh.position.clone();
    const reticleQuaternion = reticleMesh.quaternion.clone();

    // Try to create anchor from hit test result (requirement 4.1)
    let anchorCreated = false;

    if (hitTestService) {
      // We need the raw hit result  re-query is not possible here since we're
      // outside the frame loop. Use session.createAnchor with reticle transform.
      try {
        // @ts-expect-error createAnchor may not be in all type defs
        if (typeof session.createAnchor === "function") {
          const transform = new XRRigidTransform(
            { x: reticlePosition.x, y: reticlePosition.y, z: reticlePosition.z, w: 1 },
            { x: reticleQuaternion.x, y: reticleQuaternion.y, z: reticleQuaternion.z, w: reticleQuaternion.w }
          );
          // @ts-expect-error createAnchor
          const anchor: XRAnchor = await session.createAnchor(transform, localFloorSpace);
          anchorRef.current = anchor;
          anchorCreated = true;
        }
      } catch {
        // createAnchor not available or failed
      }
    }

    if (!anchorCreated) {
      // Requirement 4.6: fallback  maintain position relative to local reference space
      // Notify user that stability may be lower
      console.warn("[ARViewer] createAnchor not available  using local reference space position");
    }

    // Place furniture at reticle position (requirement 4.2)
    const dims = getFurnitureDimensions(furnitureModel);
    const MM = 0.001;

    furnitureGroup.position.copy(reticlePosition);
    furnitureGroup.quaternion.copy(reticleQuaternion);
    furnitureGroup.rotation.y = rotationYRef.current * (Math.PI / 180);

    // Scale: dimensions * 0.001 (mm to meters, requirement 5.2)
    // The group children already have correct geometry sizes; scale = 1
    // (geometry was built with MM factor applied)
    furnitureGroup.scale.set(1, 1, 1);
    furnitureGroup.visible = true;

    // Lift furniture so base sits on the detected surface
    furnitureGroup.position.y += (dims.h / 2) * MM;

    setModelPlaced(true);
    modelPlacedRef.current = true;
  }, [furnitureModel]);

  // ---------------------------------------------------------------------------
  // Task 12.4: Recolocar  delete anchor, return to surface search
  // ---------------------------------------------------------------------------
  const handleRecolocar = useCallback(() => {
    if (anchorRef.current) {
      try {
        anchorRef.current.delete?.();
      } catch {
        // ignore
      }
      anchorRef.current = null;
    }
    if (furnitureGroupRef.current) {
      furnitureGroupRef.current.visible = false;
    }
    setModelPlaced(false);
    modelPlacedRef.current = false;
  }, []);

  // ---------------------------------------------------------------------------
  // Task 12.4: Rotation controls
  // ---------------------------------------------------------------------------
  const handleRotateLeft = useCallback(() => {
    setRotationY((prev) => prev - 15);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotationY((prev) => prev + 15);
  }, []);


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const dims = getFurnitureDimensions(furnitureModel);
  const wCm = (dims.w / 10).toFixed(0);
  const hCm = (dims.h / 10).toFixed(0);
  const dCm = (dims.d / 10).toFixed(0);

  // --- Task 12.1: Support status messages ---
  if (supportStatus === "no-webxr") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <p className="text-amber-700 font-medium">
          Navegador no soporta WebXR AR. Usa Chrome para Android o Safari iOS 16+.
        </p>
        <div className="w-full h-64">
          <FallbackViewer3D model={furnitureModel} />
        </div>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-gray-200 rounded-lg text-sm"
        >
          Volver al diseñador
        </button>
      </div>
    );
  }

  if (supportStatus === "no-https") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <p className="text-red-600 font-medium">
          AR requiere conexión segura (HTTPS). Por favor, accede a la aplicación mediante HTTPS.
        </p>
        <div className="w-full h-64">
          <FallbackViewer3D model={furnitureModel} />
        </div>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-gray-200 rounded-lg text-sm"
        >
          Volver al diseñador
        </button>
      </div>
    );
  }

  if (supportStatus === "desktop" || supportStatus === "unsupported") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <p className="text-gray-600 font-medium">
          {supportStatus === "desktop"
            ? "Dispositivo no soporta AR inmersiva. Mostrando vista 3D estándar."
            : "Dispositivo no soporta AR inmersiva. Mostrando vista 3D estándar."}
        </p>
        <div className="w-full flex-1 min-h-64">
          <FallbackViewer3D model={furnitureModel} />
        </div>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-gray-200 rounded-lg text-sm"
        >
          Volver al diseñador
        </button>
      </div>
    );
  }

  // Session error state
  if (sessionStatus === "error" && sessionError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <p className="text-red-600 font-medium">{sessionError}</p>
        <div className="w-full flex-1 min-h-64">
          <FallbackViewer3D model={furnitureModel} />
        </div>
        <button
          onClick={() => { setSessionStatus("idle"); setSessionError(null); }}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          Intentar de nuevo
        </button>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-gray-200 rounded-lg text-sm"
        >
          Volver al diseñador
        </button>
      </div>
    );
  }

  // Checking state  show loading indicator without blocking UI (requirement 1.5)
  if (supportStatus === "checking") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <p className="text-gray-500 text-sm">Comprobando soporte AR...</p>
        <div className="w-full flex-1 min-h-64">
          <FallbackViewer3D model={furnitureModel} />
        </div>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-gray-200 rounded-lg text-sm"
        >
          Volver al diseñador
        </button>
      </div>
    );
  }

  // --- Supported: show canvas + "Ver en tu espacio" button or active AR session ---
  return (
    <div className="relative w-full h-full" style={{ touchAction: "none" }}>
      {/* Three.js canvas for AR rendering */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: sessionStatus === "active" ? "block" : "none" }}
        onClick={sessionStatus === "active" ? handleScreenTap : undefined}
      />

      {/* Fallback 3D view when session is idle */}
      {sessionStatus === "idle" && (
        <div className="absolute inset-0">
          <FallbackViewer3D model={furnitureModel} />
        </div>
      )}

      {/* Task 12.1: "Ver en tu espacio" button (requirement 1.4) */}
      {sessionStatus === "idle" && (
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-3 px-4">
          <button
            onClick={startARSession}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-base shadow-lg"
            style={{ minWidth: 200, minHeight: 48 }}
          >
            Ver en tu espacio
          </button>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-gray-200 rounded-lg text-sm"
          >
            Volver al diseñador
          </button>
        </div>
      )}

      {/* Task 12.4: DOM Overlay panel (requirement 6.1, 6.2) */}
      {sessionStatus === "active" && (
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 10 }}
        >
          {/* Instruction text (requirement 6.4) */}
          {!modelPlaced && (
            <div className="absolute top-8 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-black/60 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {reticleVisible
                  ? "Toca para colocar el mueble"
                  : "Apunta al suelo o a una mesa"}
              </div>
            </div>
          )}

          {/* Furniture dimensions (requirement 6.3) */}
          {sessionStatus === "active" && (
            <div className="absolute top-8 right-4 bg-black/60 text-white px-3 py-2 rounded-lg text-xs pointer-events-none">
              {wCm} × {hCm} × {dCm} cm
            </div>
          )}

          {/* Bottom control panel (requirement 6.1, 6.2) */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-4 py-4 bg-black/50 pointer-events-auto"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {/* Salir de AR (requirement 2.5) */}
            <button
              onClick={exitARSession}
              className="flex flex-col items-center gap-1 text-white"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Salir de AR"
            >
              <span className="text-xl"></span>
              <span className="text-xs">Salir</span>
            </button>

            {/* Rotar izquierda (requirement 4.4) */}
            <button
              onClick={handleRotateLeft}
              className="flex flex-col items-center gap-1 text-white"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Rotar izquierda"
            >
              <span className="text-xl"></span>
              <span className="text-xs">15°</span>
            </button>

            {/* Rotar derecha (requirement 4.4) */}
            <button
              onClick={handleRotateRight}
              className="flex flex-col items-center gap-1 text-white"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Rotar derecha"
            >
              <span className="text-xl"></span>
              <span className="text-xs">+15°</span>
            </button>

            {/* Recolocar (requirement 6.5) */}
            <button
              onClick={handleRecolocar}
              disabled={!modelPlaced}
              className="flex flex-col items-center gap-1 text-white disabled:opacity-40"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Recolocar"
            >
              <span className="text-xl"></span>
              <span className="text-xs">Recolocar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

