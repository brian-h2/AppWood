import { useMemo } from "react";
import type { CutItem } from "@/lib/furniture";
import { nestPieces } from "@/lib/nesting";
import { DEFAULT_NESTING_CONFIG } from "@/lib/types";

export function NestingView({ items }: { items: CutItem[] }) {
  const nestingConfig = DEFAULT_NESTING_CONFIG;
  const sheets = useMemo(() => nestPieces(items, nestingConfig), [items, nestingConfig]);

  if (sheets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay piezas para optimizar todavía.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Optimización de corte</h3>
          <p className="text-xs text-muted-foreground">{nestingConfig.sheet.name}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-semibold text-primary">
            {sheets.length} placa{sheets.length > 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Aprov. promedio{" "}
            {Math.round(
              (sheets.reduce(
                (a, s) => a + s.usedArea / (s.sheet.width * s.sheet.height),
                0,
              ) /
                sheets.length) *
                100,
            )}
            %
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sheets.map((s, idx) => {
          const aspect = s.sheet.width / s.sheet.height;
          const efficiency = Math.round(
            (s.usedArea / (s.sheet.width * s.sheet.height)) * 100,
          );
          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">
                  Placa #{idx + 1}
                </span>
                <span className="font-mono font-semibold text-primary">
                  {efficiency}% utilizado
                </span>
              </div>
              <div
                className="relative w-full overflow-hidden rounded-md border-2 border-primary/30 bg-secondary"
                style={{ aspectRatio: aspect }}
              >
                {s.rects.map((r, i) => {
                  const left = (r.x / s.sheet.width) * 100;
                  const top = (r.y / s.sheet.height) * 100;
                  const w = (r.w / s.sheet.width) * 100;
                  const h = (r.h / s.sheet.height) * 100;
                  return (
                    <div
                      key={i}
                      className="absolute flex items-center justify-center overflow-hidden border border-primary/40 bg-wood-light/70 text-[10px] font-medium text-primary-foreground/90"
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${w}%`,
                        height: `${h}%`,
                      }}
                      title={`${r.label} — ${r.w}×${r.h} mm`}
                    >
                      <span className="truncate px-1 text-primary">
                        {r.w}×{r.h}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
