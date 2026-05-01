import { useMemo, useState, Suspense, useEffect } from "react";
import { Viewer3D } from "@/components/Viewer3D";
import { ParamsPanel } from "@/components/ParamsPanel";
import { CutList } from "@/components/CutList";
import { NestingView } from "@/components/NestingView";
import { RoomConfigurator } from "@/components/RoomConfigurator";
import { ARViewer } from "@/components/ARViewer";
import {
  DEFAULT_PARAMS,
  buildShelf,
  aggregateCutList,
  type ShelfParams,
} from "@/lib/furniture";
import { generateCutList } from "@/lib/cutList";
import { nestPieces } from "@/lib/nesting";
import { SCENE_PRESETS } from "@/lib/scene/scenePresets";
import { DEFAULT_NESTING_CONFIG } from "@/lib/types";
import type { FurnitureModel, RoomConfiguration, PresetId, NestingConfig } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hammer, Box, Layers, Home, Camera } from "lucide-react";
import { TemplateGallery } from "@/components/TemplateGallery";
import { ParametricForm } from "@/components/ParametricForm";
import { useFurnitureStore } from "@/lib/store/furnitureStore";

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_FURNITURE_MODEL: FurnitureModel = {
  params: DEFAULT_PARAMS,
  pieces: buildShelf(DEFAULT_PARAMS),
  blocks: [],
  assemblyGraph: { nodes: new Map(), edges: [] },
  selectedMaterial: "melamine-18",
  designMode: "parametric",
};

// ---------------------------------------------------------------------------
// Scene preset cards
// ---------------------------------------------------------------------------

const PRESET_IDS: PresetId[] = ["kitchen", "bedroom", "living-room"];

interface PresetCardProps {
  presetId: PresetId;
  selected: boolean;
  onSelect: (id: PresetId) => void;
}

function PresetCard({ presetId, selected, onSelect }: PresetCardProps) {
  const preset = SCENE_PRESETS[presetId];
  return (
    <button
      onClick={() => onSelect(presetId)}
      className={[
        "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
        selected
          ? "border-primary bg-primary/10 shadow-soft"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted/40",
      ].join(" ")}
      aria-pressed={selected}
    >
      {/* Colour swatch */}
      <div
        className="h-16 w-full rounded-md"
        style={{ background: preset.wallColor, border: `3px solid ${preset.floorColor}` }}
        aria-hidden="true"
      />
      <span className="text-sm font-semibold">{preset.labelEs}</span>
      <span className="text-xs text-muted-foreground">
        {preset.roomDimensions.lengthMm / 10} × {preset.roomDimensions.widthMm / 10} ×{" "}
        {preset.roomDimensions.heightMm / 10} cm
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const Index = () => {
  // ---- Top-level tab ----
  const [activeTab, setActiveTab] = useState<"designer" | "environments" | "ar">("designer");

  // ---- FurnitureModel state ----
  const [furnitureModel, setFurnitureModel] = useState<FurnitureModel>(INITIAL_FURNITURE_MODEL);

  // ---- Nesting config ----
  const [nestingConfig] = useState<NestingConfig>(DEFAULT_NESTING_CONFIG);

  // ---- Scene preset ----
  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);

  // ---- Room configuration ----
  const [roomConfig, setRoomConfig] = useState<RoomConfiguration | null>(null);

  // ---- Zustand store blocks (Building Blocks mode) ----
  const storeBlocks = useFurnitureStore((state) => state.blocks);

  // ---- Sync storeBlocks → furnitureModel.blocks when in blocks mode ----
  useEffect(() => {
    if (furnitureModel.designMode === "blocks") {
      setFurnitureModel((prev) => ({ ...prev, blocks: storeBlocks }));
    }
  }, [storeBlocks, furnitureModel.designMode]);

  // ---- Derived: parametric mode ----
  const pieces = useMemo(
    () => buildShelf(furnitureModel.params),
    [furnitureModel.params],
  );
  const cutList = useMemo(() => aggregateCutList(pieces), [pieces]);

  // ---- Derived: blocks mode ----
  const blocksCutList = useMemo(
    () => generateCutList(furnitureModel.blocks, nestingConfig),
    [furnitureModel.blocks, nestingConfig],
  );

  // nestPieces is used here to keep the connection wired; NestingView still
  // receives the aggregated CutItem[] for display.
  const _nestedSheets = useMemo(
    () =>
      nestPieces(
        cutList.map((item) => ({ ...item, grainDirection: "none" as const })),
        nestingConfig,
      ),
    [cutList, nestingConfig],
  );

  // ---- Handlers ----
  const handleParamsChange = (params: ShelfParams) => {
    setFurnitureModel((prev) => ({
      ...prev,
      params,
      pieces: buildShelf(params),
    }));
  };

  const handleMaterialChange = (material: FurnitureModel["selectedMaterial"]) => {
    setFurnitureModel((prev) => ({ ...prev, selectedMaterial: material }));
  };

  const handleDesignModeChange = (mode: "parametric" | "blocks") => {
    setFurnitureModel((prev) => ({ ...prev, designMode: mode }));
  };

  const handlePresetSelect = (id: PresetId) => {
    setSelectedPreset((prev) => (prev === id ? null : id));
  };

  // ---- Render ----
  return (
    <div className="min-h-screen bg-gradient-workshop text-foreground">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-accent shadow-soft">
              <Hammer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-extrabold leading-none tracking-tight">
                Maderas<span className="text-accent">Caroya</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Diseño paramétrico 3D para carpintería
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <Box className="h-3.5 w-3.5" />
            MVP · Plataforma de diseño de muebles
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Top-level tab bar                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-b border-border/60 bg-background/60 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-6">
          <nav className="flex gap-1 py-2" role="tablist" aria-label="Secciones principales">
            {(
              [
                { id: "designer", label: "Diseñador", icon: Layers },
                { id: "environments", label: "Entornos", icon: Home },
                { id: "ar", label: "AR", icon: Camera },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={[
                  "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === id
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ================================================================== */}
      {/* TAB: Diseñador                                                       */}
      {/* ================================================================== */}
      {activeTab === "designer" && (
        <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[320px_1fr_380px]">
          {/* ---- Sidebar params ---- */}
          <aside className="rounded-xl border border-border bg-card p-5 shadow-soft">
            {/* Mode toggle */}
            <div className="mb-5">
              <h2 className="font-display text-base font-bold">Modo de diseño</h2>
              <div className="mt-2 flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => handleDesignModeChange("parametric")}
                  className={[
                    "flex-1 py-1.5 text-xs font-medium transition-colors",
                    furnitureModel.designMode === "parametric"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  Paramétrico
                </button>
                <button
                  onClick={() => handleDesignModeChange("blocks")}
                  className={[
                    "flex-1 py-1.5 text-xs font-medium transition-colors",
                    furnitureModel.designMode === "blocks"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  Building Blocks
                </button>
              </div>
            </div>

            {/* Material selector */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="material-select">
                Material
              </label>
              <Select
                value={furnitureModel.selectedMaterial}
                onValueChange={(v) =>
                  handleMaterialChange(v as FurnitureModel["selectedMaterial"])
                }
              >
                <SelectTrigger id="material-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="melamine-18">Melamina 18 mm</SelectItem>
                  <SelectItem value="mdf-18">MDF 18 mm</SelectItem>
                  <SelectItem value="solid-wood-20">Madera maciza 20 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Parametric params */}
            {furnitureModel.designMode === "parametric" && (
              <>
                <div className="mb-5">
                  <h2 className="font-display text-base font-bold">Parámetros</h2>
                  <p className="text-xs text-muted-foreground">
                    Ajusta y mira el cambio en tiempo real.
                  </p>
                </div>
                <ParamsPanel params={furnitureModel.params} onChange={handleParamsChange} />
              </>
            )}

            {/* Building Blocks info */}
            {furnitureModel.designMode === "blocks" && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-base font-bold mb-2">Templates</h2>
                  <TemplateGallery />
                </div>
                <ParametricForm />
              </div>
            )}
          </aside>

          {/* ---- Viewer ---- */}
          <section className="relative h-[70vh] overflow-hidden rounded-xl border border-border bg-card shadow-elegant lg:h-auto lg:min-h-[640px]">
            {furnitureModel.designMode === "parametric" ? (
              <>
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      Cargando visor 3D…
                    </div>
                  }
                >
                  <Viewer3D pieces={pieces} height={furnitureModel.params.height} />
                </Suspense>
                <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-background/85 px-3 py-1.5 text-xs font-mono text-muted-foreground shadow-soft backdrop-blur">
                  {furnitureModel.params.width} × {furnitureModel.params.height} ×{" "}
                  {furnitureModel.params.depth} mm
                </div>
                <div className="pointer-events-none absolute bottom-4 right-4 rounded-md bg-background/85 px-3 py-1.5 text-[11px] text-muted-foreground shadow-soft backdrop-blur">
                  Arrastra para rotar · Scroll para zoom
                </div>
              </>
            ) : (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Cargando visor 3D…
                  </div>
                }
              >
                <Viewer3D
                  pieces={[]}
                  height={0}
                  blocks={furnitureModel.blocks}
                />
              </Suspense>
            )}
          </section>

          {/* ---- Right panel: cut list / nesting ---- */}
          <aside className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list">Lista</TabsTrigger>
                <TabsTrigger value="nest">Optimización</TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="mt-4">
                {furnitureModel.designMode === "parametric" ? (
                  <CutList items={cutList} />
                ) : blocksCutList.length > 0 ? (
                  <div className="space-y-2">
                    {blocksCutList.map((item) => (
                      <div
                        key={item.blockId}
                        className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="ml-2 text-muted-foreground">
                          {item.cutLengthMm} × {item.cutWidthMm} × {item.thicknessMm} mm
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin bloques. Cambia a modo Paramétrico o añade bloques.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="nest" className="mt-4">
                <NestingView items={cutList} />
              </TabsContent>
            </Tabs>
          </aside>
        </main>
      )}

      {/* ================================================================== */}
      {/* TAB: Entornos                                                        */}
      {/* ================================================================== */}
      {activeTab === "environments" && (
        <main className="mx-auto max-w-[1600px] gap-6 p-4 lg:grid lg:grid-cols-[1fr_480px]">
          {/* ---- Scene Presets ---- */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4">
              <h2 className="font-display text-base font-bold">Entornos de escena</h2>
              <p className="text-xs text-muted-foreground">
                Selecciona un entorno para visualizar el mueble en contexto.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PRESET_IDS.map((id) => (
                <PresetCard
                  key={id}
                  presetId={id}
                  selected={selectedPreset === id}
                  onSelect={handlePresetSelect}
                />
              ))}
            </div>

            {selectedPreset && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                <span className="font-medium">Entorno activo:</span>{" "}
                {SCENE_PRESETS[selectedPreset].labelEs}
              </div>
            )}

            {/* 3D preview of the furniture in the selected preset */}
            <div className="relative mt-4 h-64 overflow-hidden rounded-xl border border-border bg-card shadow-elegant lg:h-80">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                    Cargando visor 3D…
                  </div>
                }
              >
                <Viewer3D pieces={pieces} height={furnitureModel.params.height} />
              </Suspense>
              {selectedPreset && (
                <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/85 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                  {SCENE_PRESETS[selectedPreset].labelEs}
                </div>
              )}
            </div>
          </section>

          {/* ---- Room Configurator ---- */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4">
              <h2 className="font-display text-base font-bold">Configurador de habitación</h2>
              <p className="text-xs text-muted-foreground">
                Define las dimensiones y obstáculos de la habitación.
              </p>
            </div>
            <RoomConfigurator
              furnitureModel={furnitureModel}
              onConfigChange={(config) => setRoomConfig(config)}
            />
            {roomConfig && (
              <p className="mt-3 text-xs text-muted-foreground">
                Habitación: {roomConfig.dimensions.lengthMm} × {roomConfig.dimensions.widthMm} ×{" "}
                {roomConfig.dimensions.heightMm} mm · {roomConfig.obstacles.length} obstáculo(s)
              </p>
            )}
          </section>
        </main>
      )}

      {/* ================================================================== */}
      {/* TAB: AR                                                              */}
      {/* ================================================================== */}
      {activeTab === "ar" && (
        <main className="mx-auto max-w-[1600px] p-4">
          <div className="h-[calc(100vh-10rem)] overflow-hidden rounded-xl border border-border bg-card shadow-elegant">
            <ARViewer
              furnitureModel={furnitureModel}
              onExit={() => setActiveTab("designer")}
            />
          </div>
        </main>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className="mx-auto max-w-[1600px] px-6 py-6 text-center text-xs text-muted-foreground">
        DoselCode Wood · Plataforma de diseño de muebles — piezas en mm, tolerancia de sierra{" "}
        {nestingConfig.sawKerfMm} mm.
      </footer>
    </div>
  );
};

export default Index;
