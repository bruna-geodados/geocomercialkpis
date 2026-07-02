import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useMemo } from "react";
import { FileStack, DollarSign, CalendarClock, Percent } from "lucide-react";
import { contractsQueryOptions } from "@/lib/queries";
import { useFilters } from "@/lib/filters-store";
import { fmtBRL, fmtBRLShort, fmtDate, fmtInt, fmtPct } from "@/lib/contracts";
import { PageShell } from "@/components/page-shell";
import { KpiCard } from "@/components/kpi-card";
import { SectionCard } from "@/components/section-card";
import { LoadingState } from "@/components/loading-state";
import { FiltersBar } from "@/components/filters-bar";

export const Route = createFileRoute("/aditivos-atual")({
  loader: ({ context }) => context.queryClient.ensureQueryData(contractsQueryOptions()),
  component: () => (
    <Suspense fallback={<LoadingState />}>
      <AditivosAtualPage />
    </Suspense>
  ),
});

function AditivosAtualPage() {
  const { data } = useSuspenseQuery(contractsQueryOptions());
  const filters = useFilters();
  const setGestao = filters.setGestao;

  // Página fixa em "Gestão Atual - Aditivos".
  useEffect(() => {
    if (filters.gestao !== "aditivo-atual") setGestao("aditivo-atual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const q = filters.busca.trim().toLowerCase();
    return data.contracts
      .filter((c) => c.gestao === "aditivo-atual")
      .filter((c) => (filters.uf !== "all" ? c.uf === filters.uf : true))
      .filter((c) =>
        q
          ? c.municipio.toLowerCase().includes(q) ||
            c.contrato.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => b.valorAditivado - a.valorAditivado);
  }, [data, filters.busca, filters.uf]);

  const totalAditivado = rows.reduce((s, c) => s + c.valorAditivado, 0);
  const totalContrato = rows.reduce((s, c) => s + c.valorContrato, 0);
  const totalSigMensal = rows.reduce((s, c) => s + c.aditivoVigente.sigWebMensal, 0);
  const totalSigLic = rows.reduce((s, c) => s + c.aditivoVigente.sigWebLicenca, 0);
  const totalTAs = rows.reduce((s, c) => s + c.countAditivos, 0);
  const percMedio = rows.length
    ? rows.reduce((s, c) => s + c.percentualAditivado, 0) / rows.length
    : 0;

  return (
    <PageShell
      title="Gestão Atual — Aditivos"
      subtitle={`${rows.length} contratos com aditivos · atualizado em ${new Date(data.fetchedAt).toLocaleString("pt-BR")}`}
    >
      <FiltersBar contracts={data.contracts} gestaoOptions={["aditivo-atual"]} />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Contratos" value={fmtInt(rows.length)} icon={<FileStack className="h-4 w-4" />} />
        <KpiCard label="TAs firmados" value={fmtInt(totalTAs)} icon={<CalendarClock className="h-4 w-4" />} />
        <KpiCard label="Valor Aditivado" value={fmtBRLShort(totalAditivado)} hint={fmtBRL(totalAditivado)} tone="accent" icon={<DollarSign className="h-4 w-4" />} />
        <KpiCard label="Base de Contratos" value={fmtBRLShort(totalContrato)} hint={fmtBRL(totalContrato)} />
        <KpiCard label="SIG Web Licença" value={fmtBRLShort(totalSigLic)} hint={fmtBRL(totalSigLic)} tone="accent" />
        <KpiCard label="SIG Web/Mensal (MRR)" value={fmtBRLShort(totalSigMensal)} hint={`${fmtBRL(totalSigMensal)} · % médio ${fmtPct(percMedio)}`} tone="success" icon={<Percent className="h-4 w-4" />} />
      </div>

      <SectionCard
        title="Aditivos por Município"
        description="Aba Gestão Atual - Aditivos · valores dos serviços/sistemas contratados via TA"
      >
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Município</th>
                <th className="py-2 pr-4">Contrato</th>
                <th className="py-2 pr-4 text-right">Nº TAs</th>
                <th className="py-2 pr-4">Vencimento</th>
                <th className="py-2 pr-4">Prazo máx. aditivos</th>
                <th className="py-2 pr-4 text-right">Valor Contrato</th>
                <th className="py-2 pr-4 text-right">Valor Aditivado</th>
                <th className="py-2 pr-4 text-right">% Aditivado</th>
                <th className="py-2 pr-4 text-right">Aero Drone</th>
                <th className="py-2 pr-4 text-right">360º</th>
                <th className="py-2 pr-4 text-right">SIG Web Lic.</th>
                <th className="py-2 pr-4 text-right">SIG Web/Mensal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={`ad-${c.numero}-${c.municipio}-${c.contrato}`} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2.5 pr-4 font-medium">
                    {c.municipio} <span className="text-muted-foreground">{c.uf}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground text-xs">{c.contrato}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">{c.countAditivos}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{fmtDate(c.vencimento)}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{fmtDate(c.prazoMaxAditivos)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{c.valorContrato > 0 ? fmtBRL(c.valorContrato) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">{c.valorAditivado > 0 ? fmtBRL(c.valorAditivado) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{fmtPct(c.percentualAditivado)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{c.aditivoVigente.aeroDrone > 0 ? fmtBRL(c.aditivoVigente.aeroDrone) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{c.aditivoVigente.m360 > 0 ? fmtBRL(c.aditivoVigente.m360) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{c.aditivoVigente.sigWebLicenca > 0 ? fmtBRL(c.aditivoVigente.sigWebLicenca) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-[oklch(0.55_0.14_155)] font-semibold">{c.aditivoVigente.sigWebMensal > 0 ? fmtBRL(c.aditivoVigente.sigWebMensal) : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    Nenhum aditivo encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageShell>
  );
}