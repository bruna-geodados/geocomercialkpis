import { create } from "zustand";
import type { Contract } from "./contracts";

interface FiltersState {
  uf: string | "all";
  ano: number | "all";
  busca: string;
  setUf: (v: string | "all") => void;
  setAno: (v: number | "all") => void;
  setBusca: (v: string) => void;
  reset: () => void;
}

export const useFilters = create<FiltersState>((set) => ({
  uf: "all",
  ano: "all",
  busca: "",
  setUf: (uf) => set({ uf }),
  setAno: (ano) => set({ ano }),
  setBusca: (busca) => set({ busca }),
  reset: () => set({ uf: "all", ano: "all", busca: "" }),
}));

export function applyFilters(
  contracts: Contract[],
  f: Pick<FiltersState, "uf" | "ano" | "busca">,
): Contract[] {
  const q = f.busca.trim().toLowerCase();
  return contracts.filter((c) => {
    if (f.uf !== "all" && c.uf !== f.uf) return false;
    if (f.ano !== "all") {
      const y = c.dataContrato?.getFullYear();
      if (y !== f.ano) return false;
    }
    if (
      q &&
      !c.municipio.toLowerCase().includes(q) &&
      !c.contrato.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}

export function toCSV(contracts: Contract[]): string {
  const headers = [
    "Município","UF","População","Contrato","Data contrato","Vigência inicial",
    "Vencimento","Valor contrato","Valor aditivado","% Aditivado","Área km²",
    "Unidades","Ticket/habitante","Dias p/ vencer","Status","MRR SIG","Módulos SIG",
  ];
  const rows = contracts.map((c) => [
    c.municipio, c.uf, c.populacao, c.contrato,
    c.dataContrato?.toLocaleDateString("pt-BR") ?? "",
    c.vigenciaInicial?.toLocaleDateString("pt-BR") ?? "",
    c.vencimento?.toLocaleDateString("pt-BR") ?? "",
    c.valorContrato, c.valorAditivado, (c.percentualAditivado * 100).toFixed(2),
    c.areaKm2, c.unidades, c.ticketPorHabitante.toFixed(2),
    c.diasParaVencer, c.statusVencimento, c.mrrSig, c.contratosSig,
  ]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(";")).join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}