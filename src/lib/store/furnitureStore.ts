/**
 * Zustand store for the Template & Parametric Form feature.
 *
 * Manages the active furniture template, current dimensions, derived blocks[],
 * validation state, and selected material.
 *
 * Units: millimetres (mm) throughout.
 */

import { create } from 'zustand';
import { type TemplateId, type TemplateDimensions, getTemplate } from '../templates/registry';
import type { BuildingBlock, MaterialType, PresetId } from '../types';
import { validateSpanLocally } from '../validation/structuralValidator';
import { DEFAULT_FINISH_ID } from '../finishes';

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface FurnitureStoreState {
  selectedTemplateId: TemplateId | null;
  dimensions: TemplateDimensions;
  blocks: BuildingBlock[];
  validationErrors: boolean;
  selectedMaterial: MaterialType;
  /** ID of the active visual finish (colour + PBR properties) */
  selectedFinishId: string;
  /**
   * Scene preset automatically applied when a template is selected.
   * null = no preset active (user hasn't selected a template yet).
   */
  activePresetId: PresetId | null;
  /**
   * Floor offset in mm for the furniture group in the viewer.
   * Derived from the selected template's floorOffsetMm.
   */
  floorOffsetMm: number;

  selectTemplate: (id: TemplateId) => void;
  setDimensions: (dims: TemplateDimensions) => void;
  setMaterial: (material: MaterialType) => void;
  setFinish: (finishId: string) => void;
  clearTemplate: () => void;
  addBlock: (block: BuildingBlock) => void;
  removeBlock: (blockId: string) => void;
}

// ---------------------------------------------------------------------------
// Initial state values
// ---------------------------------------------------------------------------

const INITIAL_DIMENSIONS: TemplateDimensions = { W: 800, H: 600, D: 300 };

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFurnitureStore = create<FurnitureStoreState>()((set, get) => ({
  // --- Initial state ---
  selectedTemplateId: null,
  dimensions: INITIAL_DIMENSIONS,
  blocks: [],
  validationErrors: false,
  selectedMaterial: 'melamine-18',
  selectedFinishId: DEFAULT_FINISH_ID,
  activePresetId: null,
  floorOffsetMm: 0,

  // --- Task 4.2: selectTemplate ---
  selectTemplate: (id: TemplateId) => {
    const template = getTemplate(id);
    const blocks = template.anchorFn(template.defaultDimensions);
    set({
      selectedTemplateId: id,
      dimensions: template.defaultDimensions,
      blocks,
      // Auto-apply the scene preset and floor offset from the template metadata
      activePresetId: template.autoPresetId,
      floorOffsetMm: template.floorOffsetMm,
    });
  },

  // --- Task 4.3: setDimensions with span validation ---
  setDimensions: (dims: TemplateDimensions) => {
    const { selectedTemplateId, selectedMaterial } = get();

    // Guard: no-op if no template is selected
    if (selectedTemplateId === null) return;

    const template = getTemplate(selectedTemplateId);
    const newBlocks = template.anchorFn(dims);

    // Run local span validation for each shelf block
    let hasErrors = false;
    for (const block of newBlocks) {
      if (block.type === 'shelf') {
        const neighbors = newBlocks.filter((b) => b.id !== block.id);
        const result = validateSpanLocally(block, neighbors, selectedMaterial);
        if (result.status !== 'ok') {
          hasErrors = true;
        }
      }
    }

    // Atomic state update
    set({ dimensions: dims, blocks: newBlocks, validationErrors: hasErrors });
  },

  // --- Task 4.4: setMaterial ---
  setMaterial: (material: MaterialType) => {
    const { selectedTemplateId, dimensions } = get();

    // Update material first so setDimensions picks it up via get()
    set({ selectedMaterial: material });

    // If a template is active, re-run setDimensions to refresh validation
    // against the new material's maxSpanMm
    if (selectedTemplateId !== null) {
      // Re-read state after the set above so selectedMaterial is current
      get().setDimensions(dimensions);
    }
  },

  // --- Task 4.4: clearTemplate ---
  clearTemplate: () => {
    set({
      selectedTemplateId: null,
      blocks: [],
      validationErrors: false,
      dimensions: INITIAL_DIMENSIONS,
      activePresetId: null,
      floorOffsetMm: 0,
    });
  },

  // --- setFinish: change the visual finish ---
  setFinish: (finishId: string) => {
    set({ selectedFinishId: finishId });
  },

  // --- addBlock: append a manually-created block ---
  addBlock: (block: BuildingBlock) => {
    set((state) => ({ blocks: [...state.blocks, block] }));
  },

  // --- removeBlock: remove a block by id ---
  removeBlock: (blockId: string) => {
    set((state) => ({ blocks: state.blocks.filter((b) => b.id !== blockId) }));
  },
}));
