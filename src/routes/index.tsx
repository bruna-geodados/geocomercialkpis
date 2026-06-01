import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import {
  Briefcase, DollarSign, TrendingUp, AlertTriangle, Home, Percent, Sparkles, FileStack, CalendarClock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { contractsQueryOptions } from "@/lib/queries";
import { applyFilters, useFilters } from "@/lib/filters-store";
import { fmtBRL, fmtBRLShort, fmtInt, fmtPct, fmtDate, SERVICE_LINES } from "@/lib/contracts";
import { PageShell } from "@/components/page-shell";
import { KpiCard } from "@/components/kpi-card";
import { FiltersBar } from "@/components/filters-bar";
import { SectionCard } from "@/components/section-card";
import { LoadingState } from "@/components/loading-state";

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(contractsQueryOptions()),
  component: () => (
    <Suspense fallback={<LoadingState />}>
      <VisaoGeral />
    </Suspense>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive text-sm">
      Erro ao carregar planilha: {error.message}
    </div>
  ),
});

const CHART_COLORS = [
  "oklch(0.28 0.08 255)",
  "oklch(0.55 0.12 245)",
  "oklch(0.68 0.10 220)",
  "oklch(0.55 0.14 155)",
  "oklch(0.72 0.16 70)",
];

function VisaoGeral() {
  const { data } = useSuspenseQuery(contractsQueryOptions());
  const filters = useFilters();
  const contracts = useMemo(() => applyFilters(data.contracts, filters), [data, filters]);

  const totalValor = contracts.reduce((s, c) => s + c.valorContrato, 0);
  const totalAditivado = contracts.reduce((s, c) => s + c.valorAditivado, 0);
  const mrr = contracts.reduce((s, c) => s + c.mrrSig, 0);
  const ticketMedio = contracts.length ? totalValor / contracts.length : 0;
  const vencendo90 = contracts.filter(
    (c) => c.diasParaVencer >= 0 && c.diasParaVencer <= 90,
  ).length;
  const aditivoMedio = contracts.length
    ? contracts.reduce((s, c) => s + c.percentualAditivado, 0) / contracts.length
    : 0;
  const totalImoveis = contracts.reduce((s, c) => s + c.unidades, 0);
  const valorPorImovel = totalImoveis > 0 ? totalValor / totalImoveis : 0;

  // Aditivos vigentes — fonte primária: aba "Gestão anterior - Aditivos vigentes"
  // Aplica filtros (UF/busca/ano) sem restringir por gestão, para o destaque
  // refletir sempre o setor de aditivos vigentes.
  const vigentesAll = useMemo(
    () => applyFilters(data.contracts, { ...filters, gestao: "vigente" }),
    [data, filters],
  );
  const aditivoVigente = {
    aeroDrone: vigentesAll.reduce((s, c) => s + c.aditivoVigente.aeroDrone, 0),
    m360: vigentesAll.reduce((s, c) => s + c.aditivoVigente.m360, 0),
    sigWebLicenca: vigentesAll.reduce(
      (s, c) => s + c.aditivoVigente.sigWebLicenca,
      0,
    ),
    sigWebMensal: vigentesAll.reduce(
      (s, c) => s + c.aditivoVigente.sigWebMensal,
      0,
    ),
  };
  const totalAditivoVigente =
    aditivoVigente.aeroDrone +
    aditivoVigente.m360 +
    aditivoVigente.sigWebLicenca +
    aditivoVigente.sigWebMensal;
  const totalTAs = vigentesAll.reduce((s, c) => s + c.countAditivos, 0);
  const municipiosComAditivo = vigentesAll.filter(
    (c) =>
      c.aditivoVigente.aeroDrone +
        c.aditivoVigente.m360 +
        c.aditivoVigente.sigWebLicenca +
        c.aditivoVigente.sigWebMensal >
      0,
  );

  const porUF = useMemo(() => {
    const m = new Map<string, { uf: string; valor: number; contratos: number }>();
    for (const c of contracts) {
      const uf = c.uf || "—";
      const cur = m.get(uf) ?? { uf, valor: 0, contratos: 0 };
      cur.valor += c.valorContrato;
      cur.contratos += 1;
      m.set(uf, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.valor - a.valor);
  }, [contracts]);

  const porLinha = useMemo(() => {
    return SERVICE_LINES.map((linha) => ({
      linha,
      valor: contracts.reduce((s, c) => s + c.receitaPorLinha[linha], 0),
    }))
      .filter((r) => r.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [contracts]);

  const topMunicipios = useMemo(
    () => [...contracts].sort((a, b) => b.valorContrato - a.valorContrato).slice(0, 10),
    [contracts],
  );

  return (
    <PageShell
      title="Visão Geral Comercial"
      subtitle={`${contracts.length} contratos ativos · atualizado em ${new Date(data.fetchedAt).toLocaleString("pt-BR")}`}
    >
      <FiltersBar contracts={data.contracts} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <KpiCard label="Contratos" value={fmtInt(contracts.length)} icon={<Briefcase className="h-4 w-4" />} />
        <KpiCard label="Carteira Total" value={fmtBRLShort(totalValor)} hint={fmtBRL(totalValor)} icon={<DollarSign className="h-4 w-4" />} tone="accent" />
        <KpiCard label="Ticket Médio" value={fmtBRLShort(ticketMedio)} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Imóveis" value={fmtInt(totalImoveis)} hint={`R$/imóvel: ${fmtBRL(valorPorImovel)}`} icon={<Home className="h-4 w-4" />} />
        <KpiCard label="MRR SIG" value={fmtBRLShort(mrr)} hint="Licenças mensais" tone="success" />
        <KpiCard label="% Aditivado Médio" value={fmtPct(aditivoMedio)} icon={<Percent className="h-4 w-4" />} hint={`Total: ${fmtBRLShort(totalAditivado)}`} />
        <KpiCard label="Vencendo em 90d" value={fmtInt(vencendo90)} icon={<AlertTriangle className="h-4 w-4" />} tone={vencendo90 > 0 ? "warning" : "default"} />
      </div>

      {anteriores.length > 0 && totalAditivoVigente > 0 && (
        <SectionCard
          title="Aditivos Vigentes — Gestão Anterior"
          description="Serviços e sistemas adicionados via aditivo contratual (colunas AB · AC · AD · AE)"
          className="border-2 border-accent/40 bg-accent/[0.03] shadow-md"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5" /> Em destaque
            </span>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KpiCard
              label="Aero Drone (aditivo)"
              value={fmtBRLShort(aditivoVigente.aeroDrone)}
              hint={fmtBRL(aditivoVigente.aeroDrone)}
              tone="accent"
            />
            <KpiCard
              label="360º (aditivo)"
              value={fmtBRLShort(aditivoVigente.m360)}
              hint={fmtBRL(aditivoVigente.m360)}
              tone="accent"
            />
            <KpiCard
              label="SIG Web Licença (aditivo)"
              value={fmtBRLShort(aditivoVigente.sigWebLicenca)}
              hint={fmtBRL(aditivoVigente.sigWebLicenca)}
              tone="accent"
            />
            <KpiCard
              label="SIG Web/Mensal (aditivo)"
              value={fmtBRLShort(aditivoVigente.sigWebMensal)}
              hint={fmtBRL(aditivoVigente.sigWebMensal)}
              tone="success"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                  <th className="py-2 pr-4">Município</th>
                  <th className="py-2 pr-4 text-right">Aero Drone (AB)</th>
                  <th className="py-2 pr-4 text-right">360º (AC)</th>
                  <th className="py-2 pr-4 text-right">SIG Web Lic. (AD)</th>
                  <th className="py-2 pr-4 text-right">SIG Web/Mensal (AE)</th>
                  <th className="py-2 pr-4 text-right">Total aditivos</th>
                </tr>
              </thead>
              <tbody>
                {municipiosComAditivo
                  .map((c) => ({
                    c,
                    total:
                      c.aditivoVigente.aeroDrone +
                      c.aditivoVigente.m360 +
                      c.aditivoVigente.sigWebLicenca +
                      c.aditivoVigente.sigWebMensal,
                  }))
                  .sort((a, b) => b.total - a.total)
                  .map(({ c, total }) => (
                    <tr key={`adv-${c.numero}-${c.municipio}`} className="border-b border-border/40 hover:bg-accent/[0.04]">
                      <td className="py-2.5 pr-4 font-medium">
                        {c.municipio} <span className="text-muted-foreground">{c.uf}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {c.aditivoVigente.aeroDrone > 0 ? fmtBRL(c.aditivoVigente.aeroDrone) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {c.aditivoVigente.m360 > 0 ? fmtBRL(c.aditivoVigente.m360) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {c.aditivoVigente.sigWebLicenca > 0 ? fmtBRL(c.aditivoVigente.sigWebLicenca) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-[oklch(0.55_0.14_155)] font-semibold">
                        {c.aditivoVigente.sigWebMensal > 0 ? fmtBRL(c.aditivoVigente.sigWebMensal) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">
                        {fmtBRL(total)}
                      </td>
                    </tr>
                  ))}
                {municipiosComAditivo.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum aditivo vigente nesta seleção.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Carteira por UF" description="Valor total contratado por estado">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porUF} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke="oklch(0.92 0.012 250)" />
                <XAxis type="number" tickFormatter={fmtBRLShort} fontSize={11} stroke="oklch(0.50 0.03 255)" />
                <YAxis type="category" dataKey="uf" fontSize={11} width={40} stroke="oklch(0.50 0.03 255)" />
                <Tooltip
                  formatter={(v: number) => fmtBRL(v)}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="valor" fill="oklch(0.28 0.08 255)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Mix de Receita por Linha de Serviço">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={porLinha}
                  dataKey="valor"
                  nameKey="linha"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={1}
                >
                  {porLinha.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Top 10 Municípios por Valor de Contrato">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Município</th>
                <th className="py-2 pr-4">UF</th>
                <th className="py-2 pr-4 text-right">População</th>
                <th className="py-2 pr-4 text-right">Valor</th>
                <th className="py-2 pr-4 text-right">R$/hab</th>
                <th className="py-2 pr-4 text-right">% Aditivado</th>
                <th className="py-2 pr-4">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {topMunicipios.map((c) => (
                <tr key={`${c.numero}-${c.municipio}`} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2.5 pr-4 font-medium">{c.municipio}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{c.uf}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{fmtInt(c.populacao)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{fmtBRLShort(c.valorContrato)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                    {c.ticketPorHabitante > 0 ? fmtBRL(c.ticketPorHabitante) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{fmtPct(c.percentualAditivado)}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {c.vencimento?.toLocaleDateString("pt-BR") ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageShell>
  );
}
