import { useMemo } from "react";
import { Search, X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useFilters, applyFilters, toCSV, downloadCSV } from "@/lib/filters-store";
import type { Contract } from "@/lib/contracts";

export function FiltersBar({ contracts }: { contracts: Contract[] }) {
  const { uf, ano, busca, gestao, setUf, setAno, setBusca, setGestao, reset } =
    useFilters();

  const ufs = useMemo(
    () => Array.from(new Set(contracts.map((c) => c.uf).filter(Boolean))).sort(),
    [contracts],
  );
  const anos = useMemo(
    () =>
      (
        Array.from(
          new Set(contracts.map((c) => c.dataContrato?.getFullYear()).filter(Boolean)),
        ) as number[]
      ).sort((a, b) => b - a),
    [contracts],
  );

  const active =
    uf !== "all" || ano !== "all" || busca.trim().length > 0 || gestao !== "nova";

  return (
    <div className="flex flex-wrap gap-2 items-center bg-card border rounded-lg p-3">
      <div className="inline-flex rounded-md border bg-background p-0.5 text-xs font-medium">
        {(
          [
            { v: "nova", label: "Nova Gestão" },
            { v: "anterior", label: "Gestão Anterior" },
            { v: "all", label: "Todas" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.v}
            onClick={() => setGestao(opt.v)}
            className={
              "px-3 py-1.5 rounded transition-colors " +
              (gestao === opt.v
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar município ou contrato..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={uf} onValueChange={setUf}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas UFs</SelectItem>
          {ufs.map((u) => (
            <SelectItem key={u} value={u}>{u}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(ano)}
        onValueChange={(v) => setAno(v === "all" ? "all" : Number(v))}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos anos</SelectItem>
          {anos.map((a) => (
            <SelectItem key={a} value={String(a)}>{a}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {active && (
        <Button variant="ghost" size="sm" onClick={reset}>
          <X className="h-4 w-4 mr-1" /> Limpar
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          downloadCSV(
            `contratos-${new Date().toISOString().slice(0, 10)}.csv`,
            toCSV(applyFilters(contracts, { uf, ano, busca, gestao })),
          )
        }
      >
        <Download className="h-4 w-4 mr-1" /> Exportar CSV
      </Button>
    </div>
  );
}