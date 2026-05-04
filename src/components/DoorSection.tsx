/**
 * DoorSection — collapsible "Aperturas" panel inside ParametricForm.
 *
 * Controls:
 *   - Door type: none / single / double
 *   - Swing direction (single only): left / right
 *   - Mount style: overlay / inset
 *   - Hardware style: barral / botón / perfil-j
 *   - Hardware position: top / center / bottom
 *
 * Shows a live size preview and structural validation warnings.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, DoorOpen } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFurnitureStore } from '@/lib/store/furnitureStore';
import { MATERIAL_SPECS } from '@/lib/types';
import type { DoorConfig, DoorType, DoorSwing, DoorMount, HardwareStyle, HardwarePosition } from '@/lib/types';
import { calcDoorSize, validateDoor } from '@/lib/doors';

export function DoorSection({ externalDims }: { externalDims?: { W: number; H: number } } = {}) {
  const {
    doorConfig,
    setDoorConfig,
    dimensions: storeDims,
    selectedMaterial,
    selectedTemplateId,
  } = useFurnitureStore();

  const [open, setOpen] = useState(false);

  // In parametric mode, externalDims is passed from furnitureModel.params.
  // In blocks mode, we use the store dimensions.
  const dims = externalDims ?? storeDims;
  // In parametric mode there's no selectedTemplateId, but the section is always enabled.
  const disabled = !externalDims && !selectedTemplateId;

  // ---- Helpers ----
  const update = <K extends keyof DoorConfig>(key: K, value: DoorConfig[K]) => {
    setDoorConfig({ ...doorConfig, [key]: value });
  };

  // ---- Live size preview ----
  const T = MATERIAL_SPECS[selectedMaterial].thickness;
  const sizeResult = calcDoorSize(dims.W, dims.H, T, doorConfig);
  const validation = sizeResult ? validateDoor(sizeResult, selectedMaterial) : null;

  return (
    <div className="rounded-lg border border-border bg-muted/10">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold disabled:opacity-50"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-muted-foreground" />
          Aperturas
          {doorConfig.type !== 'none' && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {doorConfig.type === 'single' ? 'Batiente única' : 'Doble batiente'}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">

          {/* Door type */}
          <div className="space-y-1">
            <Label htmlFor="door-type" className="text-xs">Tipo de puerta</Label>
            <Select
              value={doorConfig.type}
              onValueChange={(v) => update('type', v as DoorType)}
            >
              <SelectTrigger id="door-type" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin puerta</SelectItem>
                <SelectItem value="single">Batiente única</SelectItem>
                <SelectItem value="double">Doble batiente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {doorConfig.type !== 'none' && (
            <>
              {/* Swing direction — only for single */}
              {doorConfig.type === 'single' && (
                <div className="space-y-1">
                  <Label htmlFor="door-swing" className="text-xs">Sentido de apertura</Label>
                  <Select
                    value={doorConfig.swing}
                    onValueChange={(v) => update('swing', v as DoorSwing)}
                  >
                    <SelectTrigger id="door-swing" className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Izquierda</SelectItem>
                      <SelectItem value="right">Derecha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Mount style */}
              <div className="space-y-1">
                <Label htmlFor="door-mount" className="text-xs">Estilo de montaje</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['overlay', 'inset'] as DoorMount[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update('mount', m)}
                      aria-pressed={doorConfig.mount === m}
                      className={[
                        'rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                        doorConfig.mount === m
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted',
                      ].join(' ')}
                    >
                      {m === 'overlay' ? 'Overlay (Capa)' : 'Inset (Insertada)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hardware style */}
              <div className="space-y-1">
                <Label htmlFor="door-hardware" className="text-xs">Tirador</Label>
                <Select
                  value={doorConfig.hardwareStyle}
                  onValueChange={(v) => update('hardwareStyle', v as HardwareStyle)}
                >
                  <SelectTrigger id="door-hardware" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="barral">Barral</SelectItem>
                    <SelectItem value="boton">Botón</SelectItem>
                    <SelectItem value="perfil-j">Perfil J</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Hardware position */}
              <div className="space-y-1">
                <Label className="text-xs">Posición del tirador</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['top', 'center', 'bottom'] as HardwarePosition[]).map((pos) => {
                    const labels = { top: 'Superior', center: 'Central', bottom: 'Inferior' };
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => update('hardwarePosition', pos)}
                        aria-pressed={doorConfig.hardwarePosition === pos}
                        className={[
                          'rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                          doorConfig.hardwarePosition === pos
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted',
                        ].join(' ')}
                      >
                        {labels[pos]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live size preview */}
              {sizeResult && (
                <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Medidas de corte: </span>
                  {Math.round(sizeResult.Wp)} × {Math.round(sizeResult.Hp)} mm
                  {sizeResult.count === 2 && ' × 2 puertas'}
                  {' · '}espesor {T} mm
                </div>
              )}

              {/* Structural validation */}
              {validation && validation.status !== 'ok' && (
                <Alert variant={validation.status === 'error' ? 'destructive' : 'default'}
                  className={validation.status === 'warning' ? 'border-orange-400 bg-orange-50 text-orange-900' : ''}>
                  <AlertDescription className="text-xs">
                    {validation.message}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
