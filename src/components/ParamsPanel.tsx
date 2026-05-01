import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ShelfParams } from "@/lib/furniture";

type Props = {
  params: ShelfParams;
  onChange: (p: ShelfParams) => void;
};

const Field = ({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-baseline justify-between gap-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="flex shrink-0 items-center gap-1.5">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 w-16 font-mono text-right text-sm sm:w-20"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
    />
  </div>
);

export function ParamsPanel({ params, onChange }: Props) {
  const set = <K extends keyof ShelfParams>(k: K, v: ShelfParams[K]) =>
    onChange({ ...params, [k]: v });

  return (
    <div className="space-y-6">
      <Field
        label="Ancho"
        unit="mm"
        value={params.width}
        min={400}
        max={2400}
        step={10}
        onChange={(v) => set("width", v)}
      />
      <Field
        label="Alto"
        unit="mm"
        value={params.height}
        min={600}
        max={2400}
        step={10}
        onChange={(v) => set("height", v)}
      />
      <Field
        label="Profundidad"
        unit="mm"
        value={params.depth}
        min={200}
        max={600}
        step={10}
        onChange={(v) => set("depth", v)}
      />
      <Field
        label="Grosor de tablero"
        unit="mm"
        value={params.thickness}
        min={12}
        max={30}
        step={1}
        onChange={(v) => set("thickness", v)}
      />
      <Field
        label="Entrepaños"
        unit="ud"
        value={params.shelves}
        min={0}
        max={10}
        step={1}
        onChange={(v) => set("shelves", v)}
      />

      <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2.5">
        <Label htmlFor="hasBack" className="text-sm font-medium">
          Panel trasero
        </Label>
        <Switch
          id="hasBack"
          checked={params.hasBack}
          onCheckedChange={(v) => set("hasBack", v)}
        />
      </div>
    </div>
  );
}
