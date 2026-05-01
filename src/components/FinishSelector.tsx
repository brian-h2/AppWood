/**
 * FinishSelector — paleta visual de acabados para el visor 3D.
 *
 * Muestra un swatch de color por cada finish disponible.
 * El finish activo se resalta con un anillo de color primario.
 * Al hacer clic se actualiza el store y el visor reacciona inmediatamente.
 */

import { FINISHES } from '@/lib/finishes';
import { useFurnitureStore } from '@/lib/store/furnitureStore';
import { Label } from '@/components/ui/label';

export function FinishSelector() {
  const { selectedFinishId, setFinish } = useFurnitureStore();

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Acabado / Color</Label>
      <div className="flex flex-wrap gap-2">
        {FINISHES.map((finish) => {
          const isActive = selectedFinishId === finish.id;
          return (
            <button
              key={finish.id}
              type="button"
              title={finish.nameEs}
              aria-label={finish.nameEs}
              aria-pressed={isActive}
              onClick={() => setFinish(finish.id)}
              className={[
                'relative h-8 w-8 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'border-primary shadow-md scale-110'
                  : 'border-border hover:scale-105 hover:border-primary/50',
              ].join(' ')}
              style={{ backgroundColor: finish.color }}
            >
              {/* Active indicator dot */}
              {isActive && (
                <span
                  className="absolute inset-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="h-2 w-2 rounded-full bg-white/80 shadow-sm" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Active finish name */}
      <p className="text-xs text-muted-foreground">
        {FINISHES.find((f) => f.id === selectedFinishId)?.nameEs ?? ''}
      </p>
    </div>
  );
}
