import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Grid } from "@react-three/drei";
import { useState, useEffect, useRef, useMemo } from "react";
import type { Piece } from "@/lib/furniture";
import type { BuildingBlock, RoomConfiguration, RoomObstacle } from "@/lib/types";
import { VALIDATION_COLORS } from "@/lib/types";
import type { PresetId } from "@/lib/types";
import { SCENE_PRESETS } from "@/lib/scene/scenePresets";
import { makeFloorTexture, makeWallTexture } from "@/lib/scene/proceduralTextures";
import type { Finish } from "@/lib/finishes";
import { getFinish, DEFAULT_FINISH_ID } from "@/lib/finishes";

const MM = 0.001; // mm -> m
const WALL_THICKNESS = 0.01; // 10 mm in meters

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface Viewer3DProps {
  pieces: Piece[];
  height: number;
  // New optional props
  blocks?: BuildingBlock[];
  presetId?: PresetId | null;
  roomConfig?: RoomConfiguration | null;
  /** Active finish ID — controls colour and PBR properties of all furniture pieces */
  finishId?: string;
  /**
   * Floor offset in mm for the furniture group.
   * 0 = rests on the floor. Positive = elevated (e.g. suspended vanitory).
   */
  floorOffsetMm?: number;
}

// ---------------------------------------------------------------------------
// Finish-aware material
// ---------------------------------------------------------------------------

function FurnitureMaterial({ finish }: { finish: Finish }) {
  return (
    <meshStandardMaterial
      color={finish.color}
      roughness={finish.roughness}
      metalness={finish.metalness}
    />
  );
}

// ---------------------------------------------------------------------------
// Existing parametric piece mesh
// ---------------------------------------------------------------------------

function PieceMesh({ piece, finish }: { piece: Piece; finish: Finish }) {
  const [sx, sy, sz] = piece.size.map((v) => v * MM) as [number, number, number];
  const [px, py, pz] = piece.position.map((v) => v * MM) as [number, number, number];
  return (
    <mesh position={[px, py, pz]} castShadow receiveShadow>
      <boxGeometry args={[sx, sy, sz]} />
      <FurnitureMaterial finish={finish} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Building Block mesh with validation color support
// ---------------------------------------------------------------------------

function BlockMesh({ block, finish }: { block: BuildingBlock; finish: Finish }) {
  const sx = block.size.x * MM;
  const sy = block.size.y * MM;
  const sz = block.size.z * MM;
  const px = block.position.x * MM;
  const py = block.position.y * MM;
  const pz = block.position.z * MM;

  // Validation color takes priority over finish color.
  // ok → null means "use finish color"; warning/error → override with validation color.
  const validationColor = VALIDATION_COLORS[block.visualValidationStatus];

  return (
    <mesh
      position={[px, py, pz]}
      rotation={[block.rotation.x, block.rotation.y, block.rotation.z]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[sx, sy, sz]} />
      {validationColor !== null ? (
        <meshStandardMaterial
          color={validationColor}
          roughness={0.65}
          metalness={0.05}
        />
      ) : (
        <FurnitureMaterial finish={finish} />
      )}
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Scene Preset geometry — independent planes with procedural textures
// ---------------------------------------------------------------------------

function PresetScene({ presetId }: { presetId: PresetId }) {
  const preset = SCENE_PRESETS[presetId];
  const { lengthMm, widthMm, heightMm } = preset.roomDimensions;

  const lengthM = lengthMm * MM;
  const widthM = widthMm * MM;
  const heightM = heightMm * MM;

  // Generate procedural textures once per preset change
  const floorTex = useMemo(() => {
    const t = makeFloorTexture(preset.floorPattern, preset.floorColor);
    t.repeat.set(widthM * preset.textureRepeat, lengthM * preset.textureRepeat);
    return t;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  const wallTex = useMemo(() => {
    const t = makeWallTexture(preset.wallPattern, preset.wallColor);
    t.repeat.set(widthM * preset.textureRepeat, heightM * preset.textureRepeat);
    return t;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  const accentTex = useMemo(() => {
    if (!preset.accentWallColor) return null;
    const t = makeWallTexture('cement', preset.accentWallColor);
    t.repeat.set(widthM * preset.textureRepeat, heightM * preset.textureRepeat);
    return t;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  return (
    <group>
      {/* Floor — PlaneGeometry rotated flat, receives shadows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[widthM, lengthM]} />
        <meshStandardMaterial
          map={floorTex}
          roughness={preset.floorRoughness}
          metalness={preset.floorMetalness}
        />
      </mesh>

      {/* Ceiling — plain color, no texture needed */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, heightM, 0]}>
        <planeGeometry args={[widthM, lengthM]} />
        <meshStandardMaterial color={preset.wallColor} roughness={0.9} metalness={0} />
      </mesh>

      {/* North wall — accent wall (behind furniture), faces inward */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, heightM / 2, lengthM / 2]} receiveShadow>
        <planeGeometry args={[widthM, heightM]} />
        <meshStandardMaterial
          map={accentTex ?? wallTex}
          roughness={preset.wallRoughness}
          metalness={0}
        />
      </mesh>

      {/* South wall */}
      <mesh rotation={[0, 0, 0]} position={[0, heightM / 2, -lengthM / 2]} receiveShadow>
        <planeGeometry args={[widthM, heightM]} />
        <meshStandardMaterial map={wallTex} roughness={preset.wallRoughness} metalness={0} />
      </mesh>

      {/* East wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[widthM / 2, heightM / 2, 0]} receiveShadow>
        <planeGeometry args={[lengthM, heightM]} />
        <meshStandardMaterial map={wallTex} roughness={preset.wallRoughness} metalness={0} />
      </mesh>

      {/* West wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-widthM / 2, heightM / 2, 0]} receiveShadow>
        <planeGeometry args={[lengthM, heightM]} />
        <meshStandardMaterial map={wallTex} roughness={preset.wallRoughness} metalness={0} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Room Configuration geometry (walls, floor, ceiling, obstacles)
// ---------------------------------------------------------------------------

function obstaclePosition(
  obs: RoomObstacle,
  lengthM: number,
  widthM: number,
): { position: [number, number, number]; size: [number, number, number] } {
  const wM = obs.widthMm * MM;
  const hM = obs.heightMm * MM;
  const offsetM = obs.offsetFromLeftMm * MM;
  const floorM = obs.heightFromFloorMm * MM;
  const centerY = floorM + hM / 2;

  switch (obs.wall) {
    case "north":
      return {
        position: [-widthM / 2 + offsetM + wM / 2, centerY, lengthM / 2],
        size: [wM, hM, WALL_THICKNESS * 2],
      };
    case "south":
      return {
        position: [widthM / 2 - offsetM - wM / 2, centerY, -lengthM / 2],
        size: [wM, hM, WALL_THICKNESS * 2],
      };
    case "east":
      return {
        position: [widthM / 2, centerY, -lengthM / 2 + offsetM + wM / 2],
        size: [WALL_THICKNESS * 2, hM, wM],
      };
    case "west":
      return {
        position: [-widthM / 2, centerY, lengthM / 2 - offsetM - wM / 2],
        size: [WALL_THICKNESS * 2, hM, wM],
      };
  }
}

function RoomConfigScene({ roomConfig }: { roomConfig: RoomConfiguration }) {
  const { lengthMm, widthMm, heightMm } = roomConfig.dimensions;
  const lengthM = lengthMm * MM;
  const widthM = widthMm * MM;
  const heightM = heightMm * MM;

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[widthM, 0.01, lengthM]} />
        <meshStandardMaterial color="#C8B89A" />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, heightM, 0]}>
        <boxGeometry args={[widthM, 0.01, lengthM]} />
        <meshStandardMaterial color="#F0EDE8" transparent opacity={0.6} />
      </mesh>

      {/* North wall (positive Z) */}
      <mesh position={[0, heightM / 2, lengthM / 2]}>
        <boxGeometry args={[widthM, heightM, WALL_THICKNESS]} />
        <meshStandardMaterial color="#E8E0D8" transparent opacity={0.8} />
      </mesh>

      {/* South wall (negative Z) */}
      <mesh position={[0, heightM / 2, -lengthM / 2]}>
        <boxGeometry args={[widthM, heightM, WALL_THICKNESS]} />
        <meshStandardMaterial color="#E8E0D8" transparent opacity={0.8} />
      </mesh>

      {/* East wall (positive X) */}
      <mesh position={[widthM / 2, heightM / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, heightM, lengthM]} />
        <meshStandardMaterial color="#E8E0D8" transparent opacity={0.8} />
      </mesh>

      {/* West wall (negative X) */}
      <mesh position={[-widthM / 2, heightM / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, heightM, lengthM]} />
        <meshStandardMaterial color="#E8E0D8" transparent opacity={0.8} />
      </mesh>

      {/* Obstacles: windows (blue) and doors (orange), semi-transparent */}
      {roomConfig.obstacles.map((obs) => {
        const { position, size } = obstaclePosition(obs, lengthM, widthM);
        return (
          <mesh key={obs.id} position={position}>
            <boxGeometry args={size} />
            <meshStandardMaterial
              color={obs.type === "window" ? "#88BBFF" : "#FF8844"}
              transparent
              opacity={0.55}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Lighting component that adapts to preset or uses defaults
// ---------------------------------------------------------------------------

function SceneLighting({ presetId }: { presetId?: PresetId | null }) {
  if (presetId) {
    const preset = SCENE_PRESETS[presetId];
    return (
      <>
        <ambientLight intensity={preset.ambientIntensity} />
        <directionalLight
          position={preset.directionalPosition}
          intensity={preset.directionalIntensity}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
      </>
    );
  }

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Auto-positioning helpers
// ---------------------------------------------------------------------------

/**
 * Computes the AABB of a set of blocks in mm (local space, origin at 0,0,0).
 * Returns null if blocks array is empty.
 */
function computeBlocksAABB(
  blocks: BuildingBlock[],
): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  if (blocks.length === 0) return null;
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const b of blocks) {
    minX = Math.min(minX, b.position.x - b.size.x / 2);
    maxX = Math.max(maxX, b.position.x + b.size.x / 2);
    minZ = Math.min(minZ, b.position.z - b.size.z / 2);
    maxZ = Math.max(maxZ, b.position.z + b.size.z / 2);
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * Computes the group offset [x, y, z] in meters to:
 *   - Centre the furniture on the X axis (x = 0)
 *   - Place the back face against the north wall (z = lengthM / 2 - depth)
 *   - Lift by floorOffsetMm
 */
function computeGroupOffset(
  blocks: BuildingBlock[],
  presetId: PresetId | null | undefined,
  floorOffsetMm: number,
): [number, number, number] {
  const MM = 0.001;
  const aabb = computeBlocksAABB(blocks);
  if (!aabb) return [0, floorOffsetMm * MM, 0];

  const furnitureWidth = aabb.maxX - aabb.minX;
  const furnitureDepth = aabb.maxZ - aabb.minZ;
  const furnitureCentreX = (aabb.minX + aabb.maxX) / 2;

  // Centre on X: shift so the furniture centre lands at x=0
  const offsetX = -furnitureCentreX * MM;

  // Place against north wall: north wall is at +Z = lengthM/2
  // The back face of the furniture (maxZ) should touch the north wall.
  let offsetZ = 0;
  if (presetId) {
    const preset = SCENE_PRESETS[presetId];
    const lengthM = preset.roomDimensions.lengthMm * MM;
    const northWallZ = lengthM / 2;
    // Back face of furniture in world space = (aabb.maxZ * MM) + offsetZ = northWallZ
    offsetZ = northWallZ - aabb.maxZ * MM;
    // Clamp: don't push furniture outside the room on the south side
    const southWallZ = -lengthM / 2;
    if (offsetZ - furnitureDepth * MM < southWallZ) {
      offsetZ = southWallZ + furnitureDepth * MM;
    }
  }

  const offsetY = floorOffsetMm * MM;

  return [offsetX, offsetY, offsetZ];
}

// ---------------------------------------------------------------------------
// Main Viewer3D component
// ---------------------------------------------------------------------------

export function Viewer3D({
  pieces,
  height,
  blocks,
  presetId,
  roomConfig,
  finishId,
  floorOffsetMm = 0,
}: Viewer3DProps) {
  const yOffset = (height / 2) * MM; // parametric mode: rest on the floor
  const finish = getFinish(finishId ?? DEFAULT_FINISH_ID);

  // Compute auto-positioning offset for blocks mode
  const groupOffset = computeGroupOffset(blocks ?? [], presetId, floorOffsetMm);

  // ---------------------------------------------------------------------------
  // Fade transition overlay — triggers whenever presetId changes
  // ---------------------------------------------------------------------------
  const [fading, setFading] = useState(false);
  const prevPresetRef = useRef(presetId);

  useEffect(() => {
    if (prevPresetRef.current !== presetId) {
      prevPresetRef.current = presetId;
      setFading(true);
      const timer = setTimeout(() => setFading(false), 350);
      return () => clearTimeout(timer);
    }
  }, [presetId]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [2.4, 1.6, 2.6], fov: 35 }}
        className="!h-full !w-full"
      >
        <color attach="background" args={["#efe7da"]} />
        <fog attach="fog" args={["#efe7da", 8, 18]} />

        <SceneLighting presetId={presetId} />

        {/* Scene Preset geometry (room shell) */}
        {presetId && <PresetScene presetId={presetId} />}

        {/* Room Configuration geometry (custom room + obstacles) */}
        {roomConfig && <RoomConfigScene roomConfig={roomConfig} />}

        {/* Existing parametric pieces */}
        <group position={[0, yOffset, 0]}>
          {pieces.map((p) => (
            <PieceMesh key={p.id} piece={p} finish={finish} />
          ))}
        </group>

        {/* Building Blocks — auto-positioned against north wall, centred on X */}
        {blocks && blocks.length > 0 && (
          <group position={groupOffset}>
            {blocks.map((block) => (
              <BlockMesh key={block.id} block={block} finish={finish} />
            ))}
          </group>
        )}

        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.45}
          scale={8}
          blur={2.4}
          far={4}
        />
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
        <OrbitControls
          target={[0, yOffset, 0]}
          enableDamping
          minDistance={1.2}
          maxDistance={8}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>

      {/* Fade overlay — black overlay that fades in/out on preset change */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-300"
        style={{ opacity: fading ? 0.35 : 0 }}
      />
    </div>
  );
}
