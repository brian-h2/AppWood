/**
 * CustomPieceForm — formulario para agregar piezas individuales al diseño
 * en modo Building Blocks.
 *
 * Campos:
 *   - Material (melamine-18 | mdf-18 | solid-wood-20)
 *   - Largo (mm)
 *   - Ancho (mm)
 *   - Veta (largo | ancho | sin-veta)
 *   - Cantidad
 *   - Canto: largo superior, largo inferior, izquierdo, derecho
 *
 * Cada envío agrega `cantidad` bloques al store, apilados verticalmente
 * para que no se superpongan en el visor 3D.
 */

import { useState } from 'react';
import { useFurnitureStore } from '@/lib/store/furnitureStore';
import { MATERIAL_SPECS } from '@/lib/types';
import type { MaterialType, BuildingBlock, EdgeBandingConfig, FaceName } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GrainDirection = 'horizontal' | 'vertical' | 'none';

interface EdgeBandingToggles {
  largoSuperior: boolean;
  largoInferior: boolean;
  izquierdo: boolean;
  derecho: boolean;
}

interface FormState {
  material: MaterialType;
  largo: string;
  ancho: string;
  veta: GrainDirection;
  cantidad: string;
  canto: EdgeBandingToggles;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a stable-enough ID for a custom piece. */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Builds the EdgeBandingConfig from the toggle state.
 * Each active face gets a 0.5 mm PVC edge band.
 */
function buildEdgeBanding(toggles: EdgeBandingToggles): EdgeBandingConfig {
  const faces: Partial<Record<FaceName, { thicknessMm: number; material: 'pvc' | 'abs' | 'wood-veneer' }>> = {};
  if (toggles.largoSuperior) faces['top'] = { thicknessMm: 0.5, material: 'pvc' };
  if (toggles.largoInferior) faces['bottom'] = { thicknessMm: 0.5, material: 'pvc' };
  if (toggles.izquierdo) faces['left'] = { thicknessMm: 0.5, material: 'pvc' };
  if (toggles.derecho) faces['right'] = { thicknessMm: 0.5, material: 'pvc' };
  return { faces };
}

// ---------------------------------------------------------------------------
// Default form state
// ---------------------------------------------------------------------------

const DEFAULT_FORM: FormState = {
  material: 'melamine-18',
  largo: '600',
  ancho: '300',
  veta: 'none',
  cantidad: '1',
  canto: {
    largoSuperior: false,
    largoInferior: false,
    izquierdo: false,
    derecho: false,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomPieceForm() {
  const { addBlock, blocks } = useFurnitureStore();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);

  // ---- Field helpers ----
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const toggleCanto = (face: keyof EdgeBandingToggles) => {
    setForm((prev) => ({
      ...prev,
      canto: { ...prev.canto, [face]: !prev.canto[face] },
    }));
  };

  // ---- Validation ----
  const validate = (): string | null => {
    const largo = Number(form.largo);
    const ancho = Number(form.ancho);
    const cantidad = Number(form.cantidad);
    if (!Number.isFinite(largo) || largo <= 0) return 'El largo debe ser un número positivo.';
    if (!Number.isFinite(ancho) || ancho <= 0) return 'El ancho debe ser un número positivo.';
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100)
      return 'La cantidad debe ser un entero entre 1 y 100.';
    return null;
  };

  // ---- Submit ----
  const handleAdd = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const largo = Number(form.largo);
    const ancho = Number(form.ancho);
    const cantidad = Number(form.cantidad);
    const thickness = MATERIAL_SPECS[form.material].thickness;
    const edgeBanding = buildEdgeBanding(form.canto);

    // Stack pieces vertically above existing blocks so they don't overlap.
    // Find the current max Y extent of all blocks.
    let stackY = 0;
    for (const b of blocks) {
      const top = b.position.y + b.size.y / 2;
      if (top > stackY) stackY = top;
    }
    // Add a small gap between stacked pieces
    const GAP = 5; // mm

    for (let i = 0; i < cantidad; i++) {
      const id = generateId('custom');
      // Position: centre of the piece
      const posY = stackY + GAP + thickness / 2 + i * (thickness + GAP);

      const block: BuildingBlock = {
        id,
        type: 'shelf',
        position: { x: largo / 2, y: posY, z: ancho / 2 },
        size: { x: largo, y: thickness, z: ancho },
        rotation: { x: 0, y: 0, z: 0 },
        material: form.material,
        grainDirection: form.veta,
        edgeBanding,
        connections: [],
        parentId: null,
        visualValidationStatus: 'ok',
      };

      addBlock(block);
    }

    // Reset form (keep material and veta as convenience)
    setForm((prev) => ({
      ...DEFAULT_FORM,
      material: prev.material,
      veta: prev.veta,
    }));
  };

  // ---- Render ----
  return (
    <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold">Agregar pieza personalizada</h3>

      {/* Material */}
      <div className="space-y-1">
        <Label htmlFor="cp-material">Material</Label>
        <Select
          value={form.material}
          onValueChange={(v) => setField('material', v as MaterialType)}
        >
          <SelectTrigger id="cp-material" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="melamine-18">Melamina 18 mm</SelectItem>
            <SelectItem value="mdf-18">MDF 18 mm</SelectItem>
            <SelectItem value="solid-wood-20">Madera maciza 20 mm</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Largo y Ancho */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="cp-largo">Largo (mm)</Label>
          <Input
            id="cp-largo"
            type="number"
            min={1}
            max={5000}
            value={form.largo}
            onChange={(e) => setField('largo', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cp-ancho">Ancho (mm)</Label>
          <Input
            id="cp-ancho"
            type="number"
            min={1}
            max={5000}
            value={form.ancho}
            onChange={(e) => setField('ancho', e.target.value)}
          />
        </div>
      </div>

      {/* Veta */}
      <div className="space-y-1">
        <Label htmlFor="cp-veta">Veta</Label>
        <Select
          value={form.veta}
          onValueChange={(v) => setField('veta', v as GrainDirection)}
        >
          <SelectTrigger id="cp-veta" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin veta</SelectItem>
            <SelectItem value="horizontal">Veta en largo</SelectItem>
            <SelectItem value="vertical">Veta en ancho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cantidad */}
      <div className="space-y-1">
        <Label htmlFor="cp-cantidad">Cantidad</Label>
        <Input
          id="cp-cantidad"
          type="number"
          min={1}
          max={100}
          value={form.cantidad}
          onChange={(e) => setField('cantidad', e.target.value)}
        />
      </div>

      {/* Canto */}
      <div className="space-y-2">
        <Label>Canto (tapacanto 0.5 mm PVC)</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: 'largoSuperior', label: 'Largo superior' },
              { key: 'largoInferior', label: 'Largo inferior' },
              { key: 'izquierdo', label: 'Izquierdo' },
              { key: 'derecho', label: 'Derecho' },
            ] as { key: keyof EdgeBandingToggles; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleCanto(key)}
              className={[
                'flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                form.canto[key]
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted',
              ].join(' ')}
              aria-pressed={form.canto[key]}
            >
              <span
                className={[
                  'h-3 w-3 rounded-sm border',
                  form.canto[key] ? 'border-primary bg-primary' : 'border-muted-foreground',
                ].join(' ')}
                aria-hidden="true"
              />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Submit */}
      <Button onClick={handleAdd} className="w-full" size="sm">
        Agregar pieza
      </Button>
    </div>
  );
}
