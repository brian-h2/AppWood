import { useState, useCallback, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RoomConfiguration, RoomDimensions, FurnitureModel, RoomObstacle, WallSide, AABB, RoomConfigurationExport } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MM_TO_M = 0.001;
const WALL_THICKNESS = 0.01; // 10 mm in meters

const DEFAULT_DIMENSIONS: RoomDimensions = {
  lengthMm: 4000,
  widthMm: 3500,
  heightMm: 2600,
};

// Default form state for a new obstacle
const DEFAULT_OBSTACLE_FORM = {
  type: "window" as "window" | "door",
  wall: "north" as WallSide,
  heightFromFloorMm: 900,
  widthMm: 800,
  heightMm: 1200,
  offsetFromLeftMm: 500,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RoomConfiguratorProps {
  furnitureModel?: FurnitureModel;
  onConfigChange: (config: RoomConfiguration) => void;
}

// ---------------------------------------------------------------------------
// 3D Room Scene (rendered inside Canvas)
// ---------------------------------------------------------------------------

interface RoomSceneProps {
  lengthM: number;
  widthM: number;
  heightM: number;
  obstacles: RoomObstacle[];
}

/** Compute the 3D position and size (in meters) of an obstacle box in room space. */
function obstacleToMesh(
  obs: RoomObstacle,
  lengthM: number,
  widthM: number,
): { position: [number, number, number]; size: [number, number, number] } {
  const wM = obs.widthMm * MM_TO_M;
  const hM = obs.heightMm * MM_TO_M;
  const offsetM = obs.offsetFromLeftMm * MM_TO_M;
  const floorM = obs.heightFromFloorMm * MM_TO_M;
  const centerY = floorM + hM / 2;

  switch (obs.wall) {
    case "north":
      // North wall at +Z; left = -widthM/2, right = +widthM/2
        return {
        position: [-widthM / 2 + offsetM + wM / 2, centerY, lengthM / 2],
        size: [wM, hM, WALL_THICKNESS * 2],
      };
    case "south":
      // South wall at -Z; left = +widthM/2, right = -widthM/2 (mirrored)
      return {
        position: [widthM / 2 - offsetM - wM / 2, centerY, -lengthM / 2],
        size: [wM, hM, WALL_THICKNESS * 2],
      };
    case "east":
      // East wall at +X; left = -lengthM/2, right = +lengthM/2
      return {
        position: [widthM / 2, centerY, -lengthM / 2 + offsetM + wM / 2],
        size: [WALL_THICKNESS * 2, hM, wM],
      };
    case "west":
      // West wall at -X; left = +lengthM/2, right = -lengthM/2 (mirrored)
      return {
        position: [-widthM / 2, centerY, lengthM / 2 - offsetM - wM / 2],
        size: [WALL_THICKNESS * 2, hM, wM],
      };
  }
}

function RoomScene({ lengthM, widthM, heightM, obstacles }: RoomSceneProps) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 3]} intensity={1.0} />

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

      {/* Obstacles */}
      {obstacles.map((obs) => {
        const { position, size } = obstacleToMesh(obs, lengthM, widthM);
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

      <OrbitControls
        target={[0, heightM / 2, 0]}
        enableDamping
        minDistance={1}
        maxDistance={20}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Dimension input field with validation
// ---------------------------------------------------------------------------

interface DimensionFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
}

function DimensionField({ id, label, value, onChange, error }: DimensionFieldProps) {
  const [raw, setRaw] = useState(String(value));

  // Keep raw in sync when value changes externally
  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setRaw(text);
    const parsed = Number(text);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-sm font-medium">
        {label} <span className="text-muted-foreground font-normal">(mm)</span>
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        value={raw}
        onChange={handleChange}
        className={error ? "border-red-500 focus-visible:ring-red-500" : ""}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

interface DimensionErrors {
  lengthMm?: string;
  widthMm?: string;
  heightMm?: string;
}

function validateDimensions(dims: RoomDimensions): DimensionErrors {
  const errors: DimensionErrors = {};
  if (!dims.lengthMm || dims.lengthMm <= 0) {
    errors.lengthMm = "El largo debe ser mayor que 0";
  }
  if (!dims.widthMm || dims.widthMm <= 0) {
    errors.widthMm = "El ancho debe ser mayor que 0";
  }
  if (!dims.heightMm || dims.heightMm <= 0) {
    errors.heightMm = "El alto debe ser mayor que 0";
  }
  return errors;
}

function hasErrors(errors: DimensionErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ---------------------------------------------------------------------------
// Obstacle validation
// ---------------------------------------------------------------------------

interface ObstacleFormState {
  type: "window" | "door";
  wall: WallSide;
  heightFromFloorMm: number;
  widthMm: number;
  heightMm: number;
  offsetFromLeftMm: number;
}

interface ObstacleErrors {
  widthMm?: string;
  heightMm?: string;
  heightFromFloorMm?: string;
  offsetFromLeftMm?: string;
}

function validateObstacle(
  form: ObstacleFormState,
  room: RoomDimensions,
): ObstacleErrors {
  const errors: ObstacleErrors = {};

  // Wall width depends on orientation
  const wallWidthMm =
    form.wall === "north" || form.wall === "south"
      ? room.widthMm
      : room.lengthMm;

  if (!form.widthMm || form.widthMm <= 0) {
    errors.widthMm = "El ancho debe ser mayor que 0";
  } else if (form.offsetFromLeftMm + form.widthMm > wallWidthMm) {
    errors.widthMm = `El obstáculo excede el ancho de la pared (${wallWidthMm} mm)`;
  }

  if (!form.heightMm || form.heightMm <= 0) {
    errors.heightMm = "El alto debe ser mayor que 0";
  } else if (form.heightFromFloorMm + form.heightMm > room.heightMm) {
    errors.heightMm = `El obstáculo excede la altura de la habitación (${room.heightMm} mm)`;
  }

  if (form.heightFromFloorMm < 0) {
    errors.heightFromFloorMm = "La altura desde el suelo no puede ser negativa";
  }

  if (form.offsetFromLeftMm < 0) {
    errors.offsetFromLeftMm = "El offset no puede ser negativo";
  }

  return errors;
}

// ---------------------------------------------------------------------------
// AABB collision detection
// ---------------------------------------------------------------------------

/** Compute the AABB of an obstacle in room-space (mm, origin at room centre). */
export function obstacleToAABB(obs: RoomObstacle, room: RoomDimensions): AABB {
  const halfRoomWidth = room.widthMm / 2;
  const halfRoomLength = room.lengthMm / 2;

  switch (obs.wall) {
    case "north": {
      const minX = -halfRoomWidth + obs.offsetFromLeftMm;
      return {
        minX,
        maxX: minX + obs.widthMm,
        minY: obs.heightFromFloorMm,
        maxY: obs.heightFromFloorMm + obs.heightMm,
        minZ: halfRoomLength - 1,
        maxZ: halfRoomLength + 1,
      };
    }
    case "south": {
      const maxX = halfRoomWidth - obs.offsetFromLeftMm;
      return {
        minX: maxX - obs.widthMm,
        maxX,
        minY: obs.heightFromFloorMm,
        maxY: obs.heightFromFloorMm + obs.heightMm,
        minZ: -halfRoomLength - 1,
        maxZ: -halfRoomLength + 1,
      };
    }
    case "east": {
      const minZ = -halfRoomLength + obs.offsetFromLeftMm;
      return {
        minX: halfRoomWidth - 1,
        maxX: halfRoomWidth + 1,
        minY: obs.heightFromFloorMm,
        maxY: obs.heightFromFloorMm + obs.heightMm,
        minZ,
        maxZ: minZ + obs.widthMm,
      };
    }
    case "west": {
      const maxZ = halfRoomLength - obs.offsetFromLeftMm;
      return {
        minX: -halfRoomWidth - 1,
        maxX: -halfRoomWidth + 1,
        minY: obs.heightFromFloorMm,
        maxY: obs.heightFromFloorMm + obs.heightMm,
        minZ: maxZ - obs.widthMm,
        maxZ,
      };
    }
  }
}

/** Returns true if two AABBs intersect (volume > 0). */
export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

/** Derive the furniture AABB from FurnitureModel params (parametric mode). */
function furnitureAABBFromModel(model: FurnitureModel): AABB | null {
  if (model.designMode === "parametric" && model.params) {
    const { width, height, depth } = model.params;
    return {
      minX: -width / 2,
      maxX: width / 2,
      minY: 0,
      maxY: height,
      minZ: -depth / 2,
      maxZ: depth / 2,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RoomConfigurator({ furnitureModel, onConfigChange }: RoomConfiguratorProps) {
  const [dimensions, setDimensions] = useState<RoomDimensions>(DEFAULT_DIMENSIONS);
  const [errors, setErrors] = useState<DimensionErrors>({});

  // Obstacle state
  const [obstacles, setObstacles] = useState<RoomObstacle[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [obstacleForm, setObstacleForm] = useState<ObstacleFormState>(DEFAULT_OBSTACLE_FORM);
  const [obstacleErrors, setObstacleErrors] = useState<ObstacleErrors>({});

  // Import/export state
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify parent whenever valid dimensions or obstacles change
  useEffect(() => {
    const errs = validateDimensions(dimensions);
    setErrors(errs);
    if (!hasErrors(errs)) {
      onConfigChange({ dimensions, obstacles });
    }
  }, [dimensions, obstacles, onConfigChange]);

  const handleDimensionChange = useCallback(
    (field: keyof RoomDimensions) => (value: number) => {
      setDimensions((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Obstacle form handlers
  const handleObstacleFormChange = useCallback(
    <K extends keyof ObstacleFormState>(field: K, value: ObstacleFormState[K]) => {
      setObstacleForm((prev) => ({ ...prev, [field]: value }));
      setObstacleErrors({});
    },
    []
  );

  const handleAddObstacle = useCallback(() => {
    const errs = validateObstacle(obstacleForm, dimensions);
    if (Object.keys(errs).length > 0) {
      setObstacleErrors(errs);
      return;
    }
    const newObstacle: RoomObstacle = {
      id: crypto.randomUUID(),
      ...obstacleForm,
    };
    setObstacles((prev) => [...prev, newObstacle]);
    setObstacleForm(DEFAULT_OBSTACLE_FORM);
    setObstacleErrors({});
    setFormOpen(false);
  }, [obstacleForm, dimensions]);

  const handleDeleteObstacle = useCallback((id: string) => {
    setObstacles((prev) => prev.filter((o) => o.id !== id));
  }, []);

  // Export handler
  const handleExport = useCallback(() => {
    const data: RoomConfigurationExport = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      dimensions,
      obstacles,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'room-config.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [dimensions, obstacles]);

  // Import handler — triggered when user selects a file
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as RoomConfigurationExport;

        // Validate
        if (
          parsed.version !== '1.0' ||
          !parsed.dimensions ||
          !parsed.dimensions.lengthMm || parsed.dimensions.lengthMm <= 0 ||
          !parsed.dimensions.widthMm  || parsed.dimensions.widthMm  <= 0 ||
          !parsed.dimensions.heightMm || parsed.dimensions.heightMm <= 0
        ) {
          setImportError('El archivo no es una configuración válida (versión o dimensiones incorrectas).');
          return;
        }

        setDimensions(parsed.dimensions);
        setObstacles(Array.isArray(parsed.obstacles) ? parsed.obstacles : []);
        setImportError(null);
      } catch {
        setImportError('El archivo JSON está mal formado y no se pudo importar.');
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-selected if needed
    e.target.value = '';
  }, []);

  // Compute scene dimensions in meters (only when valid)
  const isValid = !hasErrors(validateDimensions(dimensions));
  const lengthM = dimensions.lengthMm * MM_TO_M;
  const widthM = dimensions.widthMm * MM_TO_M;
  const heightM = dimensions.heightMm * MM_TO_M;

  // Camera position: back and up enough to see the whole room
  const maxDim = Math.max(lengthM, widthM, heightM);
  const cameraDistance = maxDim * 1.8;

  // Collision detection
  const furnitureAABB = furnitureModel ? furnitureAABBFromModel(furnitureModel) : null;
  const collidingObstacles = furnitureAABB
    ? obstacles.filter((obs) => aabbIntersects(furnitureAABB, obstacleToAABB(obs, dimensions)))
    : [];
  const hasCollision = collidingObstacles.length > 0;

  const wallLabels: Record<WallSide, string> = {
    north: "Norte",
    south: "Sur",
    east: "Este",
    west: "Oeste",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Dimension inputs */}
      <div className="grid grid-cols-3 gap-4">
        <DimensionField
          id="room-length"
          label="Largo"
          value={dimensions.lengthMm}
          onChange={handleDimensionChange("lengthMm")}
          error={errors.lengthMm}
        />
        <DimensionField
          id="room-width"
          label="Ancho"
          value={dimensions.widthMm}
          onChange={handleDimensionChange("widthMm")}
          error={errors.widthMm}
        />
        <DimensionField
          id="room-height"
          label="Alto"
          value={dimensions.heightMm}
          onChange={handleDimensionChange("heightMm")}
          error={errors.heightMm}
        />
      </div>

      {/* 3D preview */}
      <div className="relative h-80 overflow-hidden rounded-lg border border-border bg-card">
        {isValid ? (
          <Canvas
            camera={{
              position: [cameraDistance, cameraDistance * 0.6, cameraDistance],
              fov: 45,
            }}
            className="!h-full !w-full"
          >
            <color attach="background" args={["#EFE7DA"]} />
            <RoomScene lengthM={lengthM} widthM={widthM} heightM={heightM} obstacles={obstacles} />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Introduce dimensiones válidas para ver la habitación
          </div>
        )}

        {/* Dimension overlay */}
        {isValid && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/85 px-2.5 py-1.5 text-xs font-mono text-muted-foreground shadow-sm backdrop-blur">
            {dimensions.lengthMm} × {dimensions.widthMm} × {dimensions.heightMm} mm
          </div>
        )}

        {/* Controls hint */}
        {isValid && (
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-background/85 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
            Arrastra para rotar · Scroll para zoom
          </div>
        )}
      </div>

      {/* Collision alert */}
      {hasCollision && (
        <Alert className="border-orange-400 bg-orange-50 text-orange-900">
          <AlertTitle>⚠ Colisión detectada</AlertTitle>
          <AlertDescription>
            El mueble colisiona con{" "}
            {collidingObstacles.length === 1
              ? "un obstáculo"
              : `${collidingObstacles.length} obstáculos`}
            :{" "}
            {collidingObstacles
              .map((o) => `${o.type === "window" ? "ventana" : "puerta"} (pared ${wallLabels[o.wall]})`)
              .join(", ")}
            .
          </AlertDescription>
        </Alert>
      )}

      {/* Obstacle management */}
      <div className="flex flex-col gap-3">
        <Collapsible open={formOpen} onOpenChange={setFormOpen}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Obstáculos</h3>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                {formOpen ? "Cancelar" : "＋ Añadir obstáculo"}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-3">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Type */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="obs-type" className="text-sm font-medium">
                    Tipo
                  </Label>
                  <Select
                    value={obstacleForm.type}
                    onValueChange={(v) => handleObstacleFormChange("type", v as "window" | "door")}
                  >
                    <SelectTrigger id="obs-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="window">Ventana</SelectItem>
                      <SelectItem value="door">Puerta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Wall */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="obs-wall" className="text-sm font-medium">
                    Pared
                  </Label>
                  <Select
                    value={obstacleForm.wall}
                    onValueChange={(v) => handleObstacleFormChange("wall", v as WallSide)}
                  >
                    <SelectTrigger id="obs-wall">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="north">Norte</SelectItem>
                      <SelectItem value="south">Sur</SelectItem>
                      <SelectItem value="east">Este</SelectItem>
                      <SelectItem value="west">Oeste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Width */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="obs-width" className="text-sm font-medium">
                    Ancho <span className="font-normal text-muted-foreground">(mm)</span>
                  </Label>
                  <Input
                    id="obs-width"
                    type="number"
                    min={1}
                    value={obstacleForm.widthMm}
                    onChange={(e) => handleObstacleFormChange("widthMm", Number(e.target.value))}
                    className={obstacleErrors.widthMm ? "border-red-500" : ""}
                    aria-invalid={!!obstacleErrors.widthMm}
                  />
                  {obstacleErrors.widthMm && (
                    <p className="text-xs text-red-500" role="alert">{obstacleErrors.widthMm}</p>
                  )}
                </div>

                {/* Height */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="obs-height" className="text-sm font-medium">
                    Alto <span className="font-normal text-muted-foreground">(mm)</span>
                  </Label>
                  <Input
                    id="obs-height"
                    type="number"
                    min={1}
                    value={obstacleForm.heightMm}
                    onChange={(e) => handleObstacleFormChange("heightMm", Number(e.target.value))}
                    className={obstacleErrors.heightMm ? "border-red-500" : ""}
                    aria-invalid={!!obstacleErrors.heightMm}
                  />
                  {obstacleErrors.heightMm && (
                    <p className="text-xs text-red-500" role="alert">{obstacleErrors.heightMm}</p>
                  )}
                </div>

                {/* Height from floor */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="obs-floor-height" className="text-sm font-medium">
                    Altura desde el suelo <span className="font-normal text-muted-foreground">(mm)</span>
                  </Label>
                  <Input
                    id="obs-floor-height"
                    type="number"
                    min={0}
                    value={obstacleForm.heightFromFloorMm}
                    onChange={(e) => handleObstacleFormChange("heightFromFloorMm", Number(e.target.value))}
                    className={obstacleErrors.heightFromFloorMm ? "border-red-500" : ""}
                    aria-invalid={!!obstacleErrors.heightFromFloorMm}
                  />
                  {obstacleErrors.heightFromFloorMm && (
                    <p className="text-xs text-red-500" role="alert">{obstacleErrors.heightFromFloorMm}</p>
                  )}
                </div>

                {/* Offset from left */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="obs-offset" className="text-sm font-medium">
                    Offset desde la izquierda <span className="font-normal text-muted-foreground">(mm)</span>
                  </Label>
                  <Input
                    id="obs-offset"
                    type="number"
                    min={0}
                    value={obstacleForm.offsetFromLeftMm}
                    onChange={(e) => handleObstacleFormChange("offsetFromLeftMm", Number(e.target.value))}
                    className={obstacleErrors.offsetFromLeftMm ? "border-red-500" : ""}
                    aria-invalid={!!obstacleErrors.offsetFromLeftMm}
                  />
                  {obstacleErrors.offsetFromLeftMm && (
                    <p className="text-xs text-red-500" role="alert">{obstacleErrors.offsetFromLeftMm}</p>
                  )}
                </div>
              </div>

              <Button className="mt-4 w-full" onClick={handleAddObstacle}>
                Añadir obstáculo
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Obstacle list */}
        {obstacles.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Lista de obstáculos">
            {obstacles.map((obs) => (
              <li
                key={obs.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium capitalize">
                    {obs.type === "window" ? "Ventana" : "Puerta"}
                  </span>{" "}
                  — pared {wallLabels[obs.wall]},{" "}
                  {obs.widthMm} × {obs.heightMm} mm, offset {obs.offsetFromLeftMm} mm,{" "}
                  suelo +{obs.heightFromFloorMm} mm
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteObstacle(obs.id)}
                  aria-label={`Eliminar obstáculo ${obs.type === "window" ? "ventana" : "puerta"} en pared ${wallLabels[obs.wall]}`}
                >
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Export / Import */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            Exportar configuración
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Importar configuración
          </Button>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
            aria-hidden="true"
          />
        </div>

        {/* Import error message */}
        {importError && (
          <p className="text-xs text-red-500" role="alert">
            {importError}
          </p>
        )}
      </div>
    </div>
  );
}

export default RoomConfigurator;
