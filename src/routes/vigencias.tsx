import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { AlertTriangle, CheckCircle2, Clock, XCircle, Home } from "lucide-react";
import { contractsQueryOptions } from "@/lib/queries";
import { applyFilters, useFilters } from "@/lib/filters-store";
import { fmtBRL, fmtBRLShort, fmtDate, fmtPct } from "@/lib/contracts";
import { PageShell } from "@/components/page-shell";
import { KpiCard } from "@/components/kpi-card";
import { FiltersBar } from "@/components/filters-bar";
import { SectionCard } from "@/components/section-card";
import { LoadingState } from "@/components/loading-state";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/vigencias")({
  loader: ({ context }) => context.queryClient.ensureQueryData(contractsQueryOptions()),
  component: () => <Suspense fallback={<LoadingState />}><Vigencias /></Suspense>,
});

const statusLabel = {
  vencido: { label: "Vencido", className: "bg-destructive text-destructive-foreground" },
  criticos: { label: "Crítico (≤30d)", className: "bg-destructive/80 text-destructive-foreground" },
  atencao: { label: "Atenção (≤90d)", className: "bg-[oklch(0.72_0.16_70)] text-white" },
  saudavel: { label: "Saudável", className: "bg-[oklch(0.55_0.14_155)] text-white" },
} as const;

function Vigencias() {
  const { data } = useSuspenseQuery(contractsQueryOptions());
  const filters = useFilters();
  const contracts = useMemo(() => applyFilters(data.contracts, filters), [data, filters]);

  const counts = useMemo(() => {
    const c = { vencido: 0, criticos: 0, atencao: 0, saudavel: 0 };
    contracts.forEach((x) => c[x.statusVencimento]++);
    return c;
  }, [contracts]);

  const aditivoAlto = contracts.filter((c) => c.percentualAditivado >= 0.2).length;
  const totalImoveis = contracts.reduce((s, c) => s + c.unidades, 0);
  const totalValor = contracts.reduce((s, c) => s + c.valorContrato, 0);
  const valorPorImovel = totalImoveis > 0 ? totalValor / totalImoveis : 0;

  const ordenados = useMemo(
    () => [...contracts].sort((a, b) => a.diasParaVencer - b.diasParaVencer),
    [contracts],
  );

  return (
    <PageShell
      title="Contratos & Vigências"
      subtitle="Alertas de vencimento e uso de aditivos contratuais"
    >
      <FiltersBar contracts={data.contracts} />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Vencidos" value={String(counts.vencido)} tone="danger" icon={<XCircle className="h-4 w-4" />} />
        <KpiCard label="Críticos (≤30d)" value={String(counts.criticos)} tone="danger" icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard label="Atenção (≤90d)" value={String(counts.atencao)} tone="warning" icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="Saudáveis" value={String(counts.saudavel)} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCard label="Aditivo ≥20%" value={String(aditivoAlto)} hint="Próximos do teto de 25%" tone={aditivoAlto > 0 ? "warning" : "default"} />
        <KpiCard label="Imóveis" value={String(totalImoveis.toLocaleString("pt-BR"))} hint={`R$/imóvel: ${fmtBRL(valorPorImovel)}`} icon={<Home className="h-4 w-4" />} />
      </div>

      <SectionCard title="Timeline de Vencimentos" description="Ordenado do mais próximo ao mais distante">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Município</th>
                <th className="py-2 pr-4">Contrato</th>
                <th className="py-2 pr-4">Início</th>
                <th className="py-2 pr-4">Vencimento</th>
                <th className="py-2 pr-4 text-right">Dias</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Valor</th>
                <th className="py-2 pr-4 text-right">% Aditivado</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((c) => {
                const s = statusLabel[c.statusVencimento];
                return (
                  <tr key={`${c.numero}-${c.municipio}`} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2.5 pr-4 font-medium">{c.municipio} <span className="text-muted-foreground">{c.uf}</span></td>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs">{c.contrato}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{fmtDate(c.vigenciaInicial)}</td>
                    <td className="py-2.5 pr-4">{fmtDate(c.vencimento)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.vencimento ? (c.diasParaVencer >= 0 ? `${c.diasParaVencer}d` : `${Math.abs(c.diasParaVencer)}d atrás`) : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge className={s.className + " text-[10px]"}>{s.label}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{fmtBRLShort(c.valorContrato)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <span className={c.percentualAditivado >= 0.2 ? "text-[oklch(0.72_0.16_70)] font-medium" : ""}>
                        {fmtPct(c.percentualAditivado)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageShell>
  );
}