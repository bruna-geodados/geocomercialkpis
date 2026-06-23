import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Plane, Cpu, Ruler, Satellite, Home, Users } from "lucide-react";
import { contractsQueryOptions } from "@/lib/queries";
import { applyFilters, useFilters } from "@/lib/filters-store";
import { fmtBRL, fmtBRLShort, fmtInt } from "@/lib/contracts";
import { PageShell } from "@/components/page-shell";
import { KpiCard } from "@/components/kpi-card";
import { FiltersBar } from "@/components/filters-bar";
import { SectionCard } from "@/components/section-card";
import { LoadingState } from "@/components/loading-state";

export const Route = createFileRoute("/aero")({
  loader: ({ context }) => context.queryClient.ensureQueryData(contractsQueryOptions()),
  component: () => (
    <Suspense fallback={<LoadingState />}><AeroPage /></Suspense>
  ),
});

const COLORS = [
  "oklch(0.28 0.08 255)",
  "oklch(0.55 0.12 245)",
  "oklch(0.68 0.10 220)",
  "oklch(0.55 0.14 155)",
];

function AeroPage() {
  const { data } = useSuspenseQuery(contractsQueryOptions());
  const filters = useFilters();
  const allContracts = useMemo(
    () => applyFilters(data.contracts, filters),
    [data, filters],
  );
  // Atas de Registro são categoria separada — não compõem agregados.
  const contracts = useMemo(() => allContracts.filter((c) => c.gestao !== "ata"), [allContracts]);

  const totalDrone = contracts.reduce((s, c) => s + c.aero.drone, 0);
  const totalTripulado = contracts.reduce((s, c) => s + c.aero.tripulado, 0);
  const totalKm2Valor = contracts.reduce((s, c) => s + c.aero.valorKm2, 0);
  const totalSatelite = contracts.reduce((s, c) => s + c.aero.satelite, 0);
  const total = totalDrone + totalTripulado + totalKm2Valor + totalSatelite;

  const areaTotal = contracts.reduce((s, c) => s + c.areaKm2, 0);
  const valorMedioKm2 = areaTotal > 0 ? totalKm2Valor / areaTotal : 0;

  const qtdDrone = contracts.filter((c) => c.aero.drone > 0).length;
  const qtdTripulado = contracts.filter((c) => c.aero.tripulado > 0).length;
  const qtdSatelite = contracts.filter((c) => c.aero.satelite > 0).length;
  const totalImoveis = contracts.reduce((s, c) => s + c.unidades, 0);
  const aeroPorImovel = totalImoveis > 0 ? total / totalImoveis : 0;
  // Valor médio por habitante: total aero ÷ população dos municípios com receita aero.
  const populacaoAero = contracts
    .filter((c) => c.aero.drone + c.aero.tripulado + c.aero.valorKm2 + c.aero.satelite > 0)
    .reduce((s, c) => s + c.populacao, 0);
  const aeroPorHab = populacaoAero > 0 ? total / populacaoAero : 0;

  const mix = [
    { tipo: "Drone (não tripulado)", valor: totalDrone, qtd: qtdDrone },
    { tipo: "Tripulado", valor: totalTripulado, qtd: qtdTripulado },
    { tipo: "Valor por km²", valor: totalKm2Valor, qtd: contracts.filter((c) => c.aero.valorKm2 > 0).length },
    { tipo: "Imagem de satélite", valor: totalSatelite, qtd: qtdSatelite },
  ].filter((m) => m.valor > 0);

  const porMunicipio = useMemo(
    () =>
      contracts
        .map((c) => ({
          municipio: `${c.municipio}${c.uf ? " - " + c.uf : ""}`,
          Drone: c.aero.drone,
          Tripulado: c.aero.tripulado,
          "Valor km²": c.aero.valorKm2,
          Satélite: c.aero.satelite,
          areaKm2: c.areaKm2,
          valorPorKm2:
            c.areaKm2 > 0
              ? (c.aero.drone + c.aero.tripulado + c.aero.valorKm2) / c.areaKm2
              : 0,
          totalAero:
            c.aero.drone + c.aero.tripulado + c.aero.valorKm2 + c.aero.satelite,
        }))
        .filter((r) => r.totalAero > 0)
        .sort((a, b) => b.totalAero - a.totalAero),
    [contracts],
  );

  return (
    <PageShell
      title="Aerolevantamento"
      subtitle="Detalhamento de tripulado, não tripulado (drone) e valor por km²"
    >
      <FiltersBar contracts={data.contracts} />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard
          label="Drone (não tripulado)"
          value={fmtBRLShort(totalDrone)}
          hint={`${qtdDrone} municípios · ${total > 0 ? ((totalDrone / total) * 100).toFixed(0) : 0}% do total`}
          icon={<Cpu className="h-4 w-4" />}
          tone="accent"
        />
        <KpiCard
          label="Tripulado"
          value={fmtBRLShort(totalTripulado)}
          hint={`${qtdTripulado} municípios · ${total > 0 ? ((totalTripulado / total) * 100).toFixed(0) : 0}% do total`}
          icon={<Plane className="h-4 w-4" />}
        />
        <KpiCard
          label="Valor médio por km²"
          value={valorMedioKm2 > 0 ? fmtBRL(valorMedioKm2) : "—"}
          hint={`Área total: ${fmtInt(Math.round(areaTotal))} km²`}
          icon={<Ruler className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Imagem de satélite"
          value={fmtBRLShort(totalSatelite)}
          hint={`${qtdSatelite} municípios`}
          icon={<Satellite className="h-4 w-4" />}
        />
        <KpiCard
          label="Aero / imóvel"
          value={fmtBRL(aeroPorImovel)}
          hint={`${fmtInt(totalImoveis)} imóveis`}
          icon={<Home className="h-4 w-4" />}
        />
        <KpiCard
          label="Aero R$/hab"
          value={fmtBRL(aeroPorHab)}
          hint={`${fmtInt(populacaoAero)} hab. com aero`}
          icon={<Users className="h-4 w-4" />}
          tone="accent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Mix de Aerolevantamento" description="Distribuição da receita por modalidade">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mix}
                  dataKey="valor"
                  nameKey="tipo"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={1}
                >
                  {mix.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Top 10 — Receita Aero por Município">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porMunicipio.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke="oklch(0.92 0.012 250)" />
                <XAxis type="number" tickFormatter={fmtBRLShort} fontSize={11} stroke="oklch(0.50 0.03 255)" />
                <YAxis type="category" dataKey="municipio" fontSize={10} width={130} stroke="oklch(0.50 0.03 255)" />
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Drone" stackId="a" fill={COLORS[0]} />
                <Bar dataKey="Tripulado" stackId="a" fill={COLORS[1]} />
                <Bar dataKey="Valor km²" stackId="a" fill={COLORS[2]} />
                <Bar dataKey="Satélite" stackId="a" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Detalhamento por Município"
        description="Drone (não tripulado), Tripulado, Valor/km² e Satélite"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Município</th>
                <th className="py-2 pr-4 text-right">Área (km²)</th>
                <th className="py-2 pr-4 text-right">Drone</th>
                <th className="py-2 pr-4 text-right">Tripulado</th>
                <th className="py-2 pr-4 text-right">Valor/km²</th>
                <th className="py-2 pr-4 text-right">R$/km² efetivo</th>
                <th className="py-2 pr-4 text-right">Satélite</th>
                <th className="py-2 pr-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {porMunicipio.map((r) => (
                <tr key={r.municipio} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2.5 pr-4 font-medium">{r.municipio}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                    {r.areaKm2 > 0 ? fmtInt(Math.round(r.areaKm2)) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r.Drone > 0 ? fmtBRLShort(r.Drone) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r.Tripulado > 0 ? fmtBRLShort(r.Tripulado) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r["Valor km²"] > 0 ? fmtBRLShort(r["Valor km²"]) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                    {r.valorPorKm2 > 0 ? fmtBRL(r.valorPorKm2) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r.Satélite > 0 ? fmtBRLShort(r.Satélite) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                    {fmtBRLShort(r.totalAero)}
                  </td>
                </tr>
              ))}
              {porMunicipio.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Nenhum município com receita de aerolevantamento neste filtro.
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