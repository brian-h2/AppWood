import { TEMPLATE_REGISTRY, type TemplateId } from '@/lib/templates/registry';
import { useFurnitureStore } from '@/lib/store/furnitureStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateGalleryProps {
  onSelect?: (templateId: TemplateId) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateGallery(props: TemplateGalleryProps): JSX.Element {
  const store = useFurnitureStore();
  const selectedTemplateId = store.selectedTemplateId;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {Object.values(TEMPLATE_REGISTRY).map((tpl) => {
        const isSelected = selectedTemplateId === tpl.id;
        const pieceCount = tpl.anchorFn(tpl.defaultDimensions).length;
        const { W, H, D } = tpl.defaultDimensions;

        return (
          <button
            key={tpl.id}
            onClick={() => {
              store.selectTemplate(tpl.id);
              props.onSelect?.(tpl.id);
            }}
            aria-pressed={isSelected}
            className={[
              'flex flex-col items-start rounded-xl border text-left transition-all',
              isSelected
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50 hover:bg-muted/40',
            ].join(' ')}
          >
            <Card className="w-full border-0 bg-transparent shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{tpl.nameEs}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {W} × {H} × {D} mm
                </p>
                <p className="text-xs text-muted-foreground">{pieceCount} piezas</p>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
