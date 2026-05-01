import { useState, useEffect } from 'react';
import { useFurnitureStore } from '@/lib/store/furnitureStore';
import { useDebounce } from '@/hooks/useDebounce';
import type { TemplateDimensions } from '@/lib/templates/registry';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ParametricFormProps {
  /** Fired after debounce when any dimension changes and validation completes */
  onDimensionsChange?: (dims: TemplateDimensions, hasErrors: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ParametricForm({ onDimensionsChange }: ParametricFormProps): JSX.Element {
  const { dimensions, setDimensions, validationErrors, selectedTemplateId } =
    useFurnitureStore();

  // Local state for immediate UI responsiveness — avoids blocking the input
  // while the debounce timer is running.
  const [localDims, setLocalDims] = useState<TemplateDimensions>(dimensions);

  // Sync localDims when store.dimensions changes externally (e.g. after
  // selectTemplate resets to defaultDimensions).
  useEffect(() => {
    setLocalDims(dimensions);
  }, [dimensions]);

  // Debounce the local dims before pushing to the store.
  const debouncedDims = useDebounce(localDims, 300);

  // Push debounced dims to the store and fire the optional callback.
  useEffect(() => {
    if (selectedTemplateId) {
      setDimensions(debouncedDims);
      onDimensionsChange?.(debouncedDims, validationErrors);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDims, selectedTemplateId]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Task 7.2 — Validation alert */}
      {validationErrors && (
        <Alert variant="destructive">
          <AlertDescription>
            El vano supera el límite del material. Reduce el ancho o cambia el material.
          </AlertDescription>
        </Alert>
      )}

      {/* Task 7.1 — Placeholder when no template is selected */}
      {!selectedTemplateId && (
        <p className="text-sm text-muted-foreground">
          Selecciona un template para editar dimensiones
        </p>
      )}

      {/* Task 7.1 — Dimension inputs */}
      <div className="grid grid-cols-3 gap-3">
        {(['W', 'H', 'D'] as const).map((dim) => (
          <div key={dim}>
            <Label htmlFor={`dim-${dim}`}>{dim} (mm)</Label>
            <Input
              id={`dim-${dim}`}
              type="number"
              value={localDims[dim]}
              min={100}
              max={3000}
              disabled={!selectedTemplateId}
              onChange={(e) =>
                setLocalDims((prev) => ({ ...prev, [dim]: Number(e.target.value) }))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
