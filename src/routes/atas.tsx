import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { FileSignature, Wallet, TrendingUp, Percent } from "lucide-react";
import { contractsQueryOptions } from "@/lib/queries";
import { applyFilters, useFilters } from "@/lib/filters-store";
import { fmtBRL, fmtBRLShort, fmtDate, fmtPct, SERVICE_LINES } from "@/lib/contracts";
import { PageShell } from "@/components/page-shell";
import { KpiCard } from "@/components/kpi-card";
import { FiltersBar } from "@/components/filters-bar";
import { SectionCard } from "@/components/section-card";
import { LoadingState } from "@/components/loading-state";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/atas")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(contractsQueryOptions()),
  component: () => (
    <Suspense fallback={<LoadingState />}>
      <AtasPage />
    </Suspense>
  ),
});

const COLORS = [
  "oklch(0.28 0.08 255)",
  "oklch(0.55 0.12 245)",
  "oklch(0.68 0.10 220)",
  "oklch(0.55 0.14 155)",
  "oklch(0.72 0.16 70)",
  "oklch(0.62 0.18 25)",
];

function AtasPage() {
  const { data } = useSuspenseQuery(contractsQueryOptions());
  const { setGestao, gestao, ...rest } = useFilters();

  // Atas page always scopes the data to the Atas tab.
  useEffect(() => {
    if (gestao !== "ata") setGestao("ata");
  }, [gestao, setGestao]);

  const atas = useMemo(
    () =>
      applyFilters(data.contracts, { ...rest, gestao: "ata" }).sort(
        (a, b) => b.valorAta - a.valorAta,
      ),
    [data, rest],
  );

  const totalAta = atas.reduce((s, c) => s + c.valorAta, 0);
  const totalContratado = atas.reduce((s, c) => s + c.valorContrato, 0);
  const utilizacao = totalAta > 0 ? totalContratado / totalAta : 0;
  const saldo = totalAta - totalContratado;

  const usoData = atas.map((c) => ({
    municipio: `${c.municipio}${c.uf ? " - " + c.uf : ""}`,
    Ata: c.valorAta,
    Contratado: c.valorContrato,
    Saldo: Math.max(c.valorAta - c.valorContrato, 0),
    pct: c.valorAta > 0 ? c.valorContrato / c.valorAta : 0,
  }));

  const mixServico = SERVICE_LINES.map((s, i) => ({
    linha: s,
    valor: atas.reduce((acc, c) => acc + (c.receitaPorLinha[s] || 0), 0),
    color: COLORS[i % COLORS.length],
  }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  return (
    <PageShell
      title="Atas de Registro de Preços"
      subtitle="Visão consolidada das atas vigentes — valor total da ata, contratado e saldo disponível para emissão de contratos"
    >
      <FiltersBar contracts={data.contracts} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Atas vigentes"
          value={String(atas.length)}
          hint="Municípios com ata registrada"
          icon={<FileSignature className="h-4 w-4" />}
          tone="accent"
        />
        <KpiCard
          label="Valor total das atas"
          value={fmtBRLShort(totalAta)}
          hint="Teto autorizado para contratação"
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiCard
          label="Valor contratado"
          value={fmtBRLShort(totalContratado)}
          hint={`Saldo disponível: ${fmtBRLShort(saldo)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Utilização média"
          value={fmtPct(utilizacao)}
          hint="Contratado ÷ valor da ata"
          icon={<Percent className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Ata vs. Contratado por município"
          description="Quanto de cada ata já foi convertido em contrato"
        >
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usoData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke="oklch(0.92 0.012 250)" />
                <XAxis
                  type="number"
                  tickFormatter={fmtBRLShort}
                  fontSize={11}
                  stroke="oklch(0.50 0.03 255)"
                />
                <YAxis
                  type="category"
                  dataKey="municipio"
                  fontSize={10}
                  width={140}
                  stroke="oklch(0.50 0.03 255)"
                />
                <Tooltip
                  formatter={(v: number) => fmtBRL(v)}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Contratado" stackId="a" fill={COLORS[0]} />
                <Bar dataKey="Saldo" stackId="a" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Mix de receita (preços unitários da ata)"
          description="Distribuição por linha de serviço considerando todos os itens da ata"
        >
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mixServico} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke="oklch(0.92 0.012 250)" />
                <XAxis
                  type="number"
                  tickFormatter={fmtBRLShort}
                  fontSize={11}
                  stroke="oklch(0.50 0.03 255)"
                />
                <YAxis
                  type="category"
                  dataKey="linha"
                  fontSize={11}
                  width={150}
                  stroke="oklch(0.50 0.03 255)"
                />
                <Tooltip
                  formatter={(v: number) => fmtBRL(v)}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]} fill={COLORS[1]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Detalhamento das atas"
        description="Valor da ata, contratado, saldo, vigência e aerolevantamento"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Município</th>
                <th className="py-2 pr-4">Ata</th>
                <th className="py-2 pr-4">Vigência</th>
                <th className="py-2 pr-4 text-right">Valor da Ata</th>
                <th className="py-2 pr-4 text-right">Contratado</th>
                <th className="py-2 pr-4 text-right">Saldo</th>
                <th className="py-2 pr-4 text-right">Uso</th>
                <th className="py-2 pr-4 text-right">Aero Drone</th>
                <th className="py-2 pr-4 text-right">Aero Tripulado</th>
                <th className="py-2 pr-4 text-right">R$/km²</th>
              </tr>
            </thead>
            <tbody>
              {atas.map((c) => {
                const saldo = c.valorAta - c.valorContrato;
                const uso = c.valorAta > 0 ? c.valorContrato / c.valorAta : 0;
                return (
                  <tr
                    key={`${c.municipio}-${c.contrato}`}
                    className="border-b border-border/40 hover:bg-muted/30"
                  >
                    <td className="py-2.5 pr-4 font-medium">
                      {c.municipio}
                      {c.uf ? ` - ${c.uf}` : ""}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">
                      {c.contrato}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                      {fmtDate(c.vencimento)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                      {fmtBRLShort(c.valorAta)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {fmtBRLShort(c.valorContrato)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                      {fmtBRLShort(saldo)}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Badge
                        variant={uso >= 0.8 ? "default" : "secondary"}
                        className="tabular-nums"
                      >
                        {fmtPct(uso)}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.aero.drone > 0 ? fmtBRLShort(c.aero.drone) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.aero.tripulado > 0 ? fmtBRLShort(c.aero.tripulado) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                      {c.aero.valorKm2 > 0 ? fmtBRL(c.aero.valorKm2) : "—"}
                    </td>
                  </tr>
                );
              })}
              {atas.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="py-12 text-center text-muted-foreground"
                  >
                    Nenhuma ata encontrada para os filtros selecionados.
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