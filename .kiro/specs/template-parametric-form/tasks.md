# Implementation Plan: Template & Parametric Form

## Overview

Add a Templates layer and Parametric Form to the DoselCode furniture design platform. Users pick a pre-built template from a gallery, then resize it via a form with 300 ms debounce. Anchor functions re-scale all `BuildingBlock` pieces deterministically. Structural validation runs on every dimension change and surfaces warnings in the 3D viewer via `VALIDATION_COLORS`.

Implementation language: **TypeScript / React** (matches the existing codebase).

## Tasks

- [x] 1. Install Zustand dependency
  - Run `npm install zustand@^4.5.2` in the project root
  - Verify `zustand` appears in `dependencies` in `package.json`
  - _Requirements: store depends on zustand (design §Dependencies)_

- [x] 2. Create Template Registry (`src/lib/templates/registry.ts`)
  - [x] 2.1 Define `TemplateId`, `TemplateDimensions`, and `TemplateDef` types
    - Export `TemplateId = 'alacena-cocina' | 'escritorio-flotante' | 'rack-tv-bajo'`
    - Export `TemplateDimensions { W, H, D }` interface
    - Export `TemplateDef { id, nameEs, defaultDimensions, anchorFn }` interface
    - _Requirements: design §Component 3 — Template Registry_

  - [x] 2.2 Implement `makeBlock` helper and the three anchor functions
    - Write a `makeBlock(id, type, position, size)` helper that returns a fully-formed `BuildingBlock` with stable ID, zero rotation, default `edgeBanding`, `grainDirection: 'none'`, `parentId: null`, `visualValidationStatus: 'ok'`, and `connections: []`
    - Implement `alacenaAnchorFn` — 8 pieces (2 laterales, techo, piso, estante central, fondo MDF, 2 puertas) using `T = 18` and the position/size formulas from the design's anchor table
    - Implement `escritorioAnchorFn` — 6 pieces (tapa, base, 2 laterales internos, divisor central, refuerzo posterior)
    - Implement `rackTvAnchorFn` — 7 pieces (tapa, base, 2 laterales internos, 2 divisores internos, fondo central parcial)
    - Each anchor function must skip pieces where any size dimension ≤ 0 (guard clause)
    - _Requirements: design §Anchor Function Contract, §Example Usage_

  - [x] 2.3 Build `TEMPLATE_REGISTRY` and `getTemplate`
    - Populate `TEMPLATE_REGISTRY: Record<TemplateId, TemplateDef>` with default dimensions: Alacena (800×600×300), Escritorio (1200×150×500), Rack TV (1600×450×400)
    - Implement `getTemplate(id: TemplateId): TemplateDef` — returns the registry entry; TypeScript union type guarantees no unknown IDs at compile time
    - _Requirements: design §getTemplate formal spec_

  - [ ]* 2.4 Write property-based tests for the registry (P-TPF-1 through P-TPF-6)
    - Create `src/test/templateRegistry.test.ts` using `fast-check` + `vitest` with `numRuns: 100`
    - Define `validDimsArb = fc.record({ W: fc.integer({min:100,max:3000}), H: fc.integer({min:100,max:3000}), D: fc.integer({min:100,max:3000}) })`
    - Define `templateIdArb = fc.constantFrom('alacena-cocina','escritorio-flotante','rack-tv-bajo')`
    - **Property P-TPF-1: Non-overlapping blocks** — for any valid dims and any template, no two blocks in `anchorFn(dims)` have overlapping AABBs (use `blockToAABB` and check all pairs `i ≠ j`)
    - **Property P-TPF-2: Strictly positive sizes** — for any valid dims and any template, every block in `anchorFn(dims)` has `size.x > 0 && size.y > 0 && size.z > 0`
    - **Property P-TPF-3: Anchor function purity** — for any valid dims and any template, two calls to `anchorFn(dims)` produce deep-equal results with identical block IDs
    - **Property P-TPF-4: Validation warning fires iff span exceeds limit** — for any valid dims, for each shelf block in `alacenaAnchorFn(dims)`, `validateSpanLocally` status is `!== 'ok'` iff the computed span exceeds `MATERIAL_SPECS[material].maxSpanMm * 0.9`
    - **Property P-TPF-5: Piece count invariant** — for any two valid dims objects `d1` and `d2`, `anchorFn(d1).length === anchorFn(d2).length` for each template
    - **Property P-TPF-6: Right lateral X anchor** — for any valid dims, the block with id `*-lateral-der` (or equivalent right lateral) in `alacenaAnchorFn(dims)` has `position.x === dims.W - 9` (i.e. `W - T/2` where `T = 18`)
    - _Requirements: design §Correctness Properties P-TPF-1 through P-TPF-6_

- [x] 3. Create `useDebounce` hook (`src/hooks/useDebounce.ts`)
  - Implement a generic `useDebounce<T>(value: T, delayMs: number): T` hook using `useState` + `useEffect` with `setTimeout` / `clearTimeout` cleanup
  - Export as named export `useDebounce`
  - _Requirements: design §Component 2 — ParametricForm (300 ms debounce)_

- [x] 4. Create Zustand store (`src/lib/store/furnitureStore.ts`)
  - [x] 4.1 Define `FurnitureStoreState` interface and create the store
    - Import `TemplateId`, `TemplateDimensions`, `BuildingBlock`, `MaterialType` from their respective modules
    - Define the full interface: `selectedTemplateId`, `dimensions`, `blocks`, `validationErrors`, `selectedMaterial`, and the four actions `selectTemplate`, `setDimensions`, `setMaterial`, `clearTemplate`
    - Create `useFurnitureStore` with `create<FurnitureStoreState>()(...)` from `zustand`
    - Initial state: `selectedTemplateId: null`, `dimensions: { W: 800, H: 600, D: 300 }`, `blocks: []`, `validationErrors: false`, `selectedMaterial: 'melamine-18'`
    - _Requirements: design §Component 4 — Zustand Store_

  - [x] 4.2 Implement `selectTemplate` action
    - Look up `TemplateDef` via `getTemplate(id)`
    - Run `anchorFn(defaultDimensions)` to generate initial `blocks[]`
    - Set `selectedTemplateId`, `dimensions` (from `defaultDimensions`), and `blocks` atomically via `set({...})`
    - _Requirements: design §selectTemplate, §Template Selection Flow sequence diagram_

  - [x] 4.3 Implement `setDimensions` action with span validation
    - Guard: if `selectedTemplateId` is null, return early
    - Run `anchorFn(newDims)` for the active template
    - For each block where `block.type === 'shelf'`, call `validateSpanLocally(block, neighbors, selectedMaterial)` and collect `hasErrors`
    - Atomically set `dimensions`, `blocks`, and `validationErrors`
    - _Requirements: design §setDimensions algorithm, §Parametric Form Dimension Change Flow_

  - [x] 4.4 Implement `setMaterial` and `clearTemplate` actions
    - `setMaterial`: update `selectedMaterial`; if a template is active, re-run `setDimensions` with current dimensions to refresh validation against the new material's `maxSpanMm`
    - `clearTemplate`: reset to initial state (`selectedTemplateId: null`, `blocks: []`, `validationErrors: false`)
    - _Requirements: design §FurnitureStoreState interface_

- [x] 5. Checkpoint — verify domain layer
  - Run `npm test` and confirm all existing tests still pass and the new property tests in `templateRegistry.test.ts` pass
  - Ensure all tests pass; ask the user if questions arise.

- [x] 6. Create `TemplateGallery` component (`src/components/TemplateGallery.tsx`)
  - Import `TEMPLATE_REGISTRY` and `useFurnitureStore`
  - Render a responsive grid (`grid grid-cols-1 gap-3 sm:grid-cols-3`) of `shadcn/ui Card` components — one per template
  - Each card displays: template `nameEs`, default dimensions (`W × H × D mm`), and piece count
  - Each card is a `<button>` with `aria-pressed={selectedTemplateId === tpl.id}` and `onClick={() => store.selectTemplate(tpl.id)}`
  - Highlight the active card with `border-primary` / `bg-primary/10` classes (matching the existing `PresetCard` pattern in `Index.tsx`)
  - Accept optional `onSelect?: (templateId: TemplateId) => void` prop and call it after `store.selectTemplate`
  - _Requirements: design §Component 1 — TemplateGallery, §Example Usage_

- [x] 7. Create `ParametricForm` component (`src/components/ParametricForm.tsx`)
  - [x] 7.1 Implement dimension inputs with local state and debounce
    - Import `useFurnitureStore` and `useDebounce`
    - Maintain `localDims` in `useState` initialised from `store.dimensions`
    - Sync `localDims` back when `store.dimensions` changes externally (e.g. after `selectTemplate`)
    - Apply `useDebounce(localDims, 300)` and call `store.setDimensions(debouncedDims)` in a `useEffect` when `selectedTemplateId` is set
    - Render three `shadcn/ui Input` fields (W, H, D) with `type="number"`, `min={100}`, `max={3000}`, `disabled={!selectedTemplateId}`
    - Add `shadcn/ui Label` for each input (`htmlFor="dim-W"` etc.)
    - Show placeholder message "Selecciona un template para editar dimensiones" when no template is selected
    - _Requirements: design §Component 2 — ParametricForm, §Example Usage_

  - [x] 7.2 Add validation Alert and `onDimensionsChange` callback
    - When `store.validationErrors` is `true`, render a `shadcn/ui Alert` with `variant="destructive"` and the message "El vano supera el límite del material. Reduce el ancho o cambia el material."
    - Accept optional `onDimensionsChange?: (dims: TemplateDimensions, hasErrors: boolean) => void` prop and call it after each debounced update
    - _Requirements: design §Error Scenario 2, §ParametricForm responsibilities_

- [x] 8. Integrate into `Index.tsx`
  - [x] 8.1 Replace the Building Blocks placeholder with `TemplateGallery` + `ParametricForm`
    - Import `TemplateGallery`, `ParametricForm`, and `useFurnitureStore` in `Index.tsx`
    - In the `furnitureModel.designMode === 'blocks'` branch of the sidebar, replace the dashed placeholder `<div>` with `<TemplateGallery />` followed by `<ParametricForm />`
    - _Requirements: design §Index.tsx integration_

  - [x] 8.2 Sync Zustand `store.blocks` into `furnitureModel.blocks` for Viewer3D
    - Subscribe to `useFurnitureStore` and read `store.blocks`
    - In a `useEffect` (or inline in the render path), when `furnitureModel.designMode === 'blocks'`, call `setFurnitureModel(prev => ({ ...prev, blocks: store.blocks }))` whenever `store.blocks` changes
    - In the Building Blocks viewer branch, replace the "coming soon" placeholder with `<Viewer3D blocks={furnitureModel.blocks} ... />` (pass `blocks` to the existing `Viewer3D` component so it renders template pieces with `VALIDATION_COLORS`)
    - _Requirements: design §Zustand Store — sync with FurnitureModel, §Rendering Layer_

- [x] 9. Final checkpoint — full test suite and build
  - Run `npm test` — all tests (existing + new property tests) must pass
  - Run `npm run build` — TypeScript compilation must succeed with zero errors
  - Ensure all tests pass and the build is clean; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific sections of `design.md` for traceability
- `T = 18` mm is the material thickness constant used throughout all anchor functions
- Block IDs use the pattern `'{templateId}-{pieceName}'` (e.g. `'alacena-lateral-izq'`) to ensure stable React Three Fiber keys and deterministic property test results
- Property tests use `numRuns: 100` and the `validDimsArb` / `templateIdArb` arbitraries defined in the design
- The `setMaterial` action in the store must re-run validation so `VALIDATION_COLORS` update immediately when the user switches material in the existing material selector
