import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Grid } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { Piece } from "@/lib/furniture";
import type { BuildingBlock, RoomConfiguration, RoomObstacle } from "@/lib/types";
import { VALIDATION_COLORS } from "@/lib/types";
import type { PresetId } from "@/lib/types";
import { SCENE_PRESETS } from "@/lib/scene/scenePresets";

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
}

// ---------------------------------------------------------------------------
// Wood material (existing)
// ---------------------------------------------------------------------------

function WoodMaterial() {
  const color = useMemo(() => {
    const root = getComputedStyle(document.documentElement);
    const hsl = root.getPropertyValue("--wood-mid").trim();
    return new THREE.Color(`hsl(${hsl})`);
  }, []);
  return (
    <meshStandardMaterial color={color} roughness={0.65} metalness={0.05} />
  );
}

// ---------------------------------------------------------------------------
// Existing parametric piece mesh
// ---------------------------------------------------------------------------

function PieceMesh({ piece }: { piece: Piece }) {
  const [sx, sy, sz] = piece.size.map((v) => v * MM) as [number, number, number];
  const [px, py, pz] = piece.position.map((v) => v * MM) as [number, number, number];
  return (
    <mesh position={[px, py, pz]} castShadow receiveShadow>
      <boxGeometry args={[sx, sy, sz]} />
      <WoodMaterial />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Building Block mesh with validation color support
// ---------------------------------------------------------------------------

function BlockMesh({ block }: { block: BuildingBlock }) {
  const sx = block.size.x * MM;
  const sy = block.size.y * MM;
  const sz = block.size.z * MM;
  const px = block.position.x * MM;
  const py = block.position.y * MM;
  const pz = block.position.z * MM;

  // Determine color: use VALIDATION_COLORS override if not null, else default wood color
  const validationColor = VALIDATION_COLORS[block.visualValidationStatus];

  const woodColor = useMemo(() => {
    const root = getComputedStyle(document.documentElement);
    const hsl = root.getPropertyValue("--wood-mid").trim();
    return new THREE.Color(`hsl(${hsl})`);
  }, []);

  const color = validationColor !== null ? validationColor : woodColor;

  return (
    <mesh
      position={[px, py, pz]}
      rotation={[block.rotation.x, block.rotation.y, block.rotation.z]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial color={color} roughness={0.65} metalness={0.05} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Scene Preset geometry group
// ---------------------------------------------------------------------------

function PresetScene({ presetId }: { presetId: PresetId }) {
  const preset = SCENE_PRESETS[presetId];
  const { lengthMm, widthMm, heightMm } = preset.roomDimensions;

  const lengthM = lengthMm * MM;
  const widthM = widthMm * MM;
  const heightM = heightMm * MM;

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[widthM, 0.01, lengthM]} />
        <meshStandardMaterial color={preset.floorColor} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, heightM, 0]}>
        <boxGeometry args={[widthM, 0.01, lengthM]} />
        <meshStandardMaterial color={preset.wallColor} />
      </mesh>

      {/* North wall (positive Z) */}
      <mesh position={[0, heightM / 2, lengthM / 2]}>
        <boxGeometry args={[widthM, heightM, WALL_THICKNESS]} />
        <meshStandardMaterial color={preset.wallColor} />
      </mesh>

      {/* South wall (negative Z) */}
      <mesh position={[0, heightM / 2, -lengthM / 2]}>
        <boxGeometry args={[widthM, heightM, WALL_THICKNESS]} />
        <meshStandardMaterial color={preset.wallColor} />
      </mesh>

      {/* East wall (positive X) */}
      <mesh position={[widthM / 2, heightM / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, heightM, lengthM]} />
        <meshStandardMaterial color={preset.wallColor} />
      </mesh>

      {/* West wall (negative X) */}
      <mesh position={[-widthM / 2, heightM / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, heightM, lengthM]} />
        <meshStandardMaterial color={preset.wallColor} />
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
// Main Viewer3D component
// ---------------------------------------------------------------------------

export function Viewer3D({
  pieces,
  height,
  blocks,
  presetId,
  roomConfig,
}: Viewer3DProps) {
  const yOffset = (height / 2) * MM; // rest on the floor

  return (
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
          <PieceMesh key={p.id} piece={p} />
        ))}
      </group>

      {/* Building Blocks */}
      {blocks && blocks.length > 0 && (
        <group>
          {blocks.map((block) => (
            <BlockMesh key={block.id} block={block} />
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
  );
}
