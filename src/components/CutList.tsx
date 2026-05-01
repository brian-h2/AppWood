import type { CutItem } from "@/lib/furniture";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function CutList({ items }: { items: CutItem[] }) {
  const total = items.reduce((acc, it) => acc + it.qty, 0);

  const downloadCSV = () => {
    const header = "Pieza,Largo (mm),Ancho (mm),Grosor (mm),Cantidad\n";
    const rows = items
      .map((it) => `"${it.name}",${it.length},${it.width},${it.thickness},${it.qty}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lista-de-corte-doselcode.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Lista de corte</h3>
          <p className="text-xs text-muted-foreground">
            {items.length} tipos · {total} piezas totales
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCSV}>
          <Download className="mr-1.5 h-4 w-4" />
          CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead>Pieza</TableHead>
              <TableHead className="text-right font-mono">Largo</TableHead>
              <TableHead className="text-right font-mono">Ancho</TableHead>
              <TableHead className="text-right font-mono">Esp.</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{it.name}</TableCell>
                <TableCell className="text-right font-mono text-sm">{it.length}</TableCell>
                <TableCell className="text-right font-mono text-sm">{it.width}</TableCell>
                <TableCell className="text-right font-mono text-sm">{it.thickness}</TableCell>
                <TableCell className="text-right font-semibold">{it.qty}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
