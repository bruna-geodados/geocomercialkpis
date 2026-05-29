import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { contractsQueryOptions } from "@/lib/queries";
import { applyFilters, useFilters } from "@/lib/filters-store";
import { fmtBRL, fmtBRLShort, fmtInt, SERVICE_LINES, fmtDate } from "@/lib/contracts";
import { Home } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { KpiCard } from "@/components/kpi-card";
import { FiltersBar } from "@/components/filters-bar";
import { SectionCard } from "@/components/section-card";
import { LoadingState } from "@/components/loading-state";

export const Route = createFileRoute("/municipios")({
  loader: ({ context }) => context.queryClient.ensureQueryData(contractsQueryOptions()),
  component: () => <Suspense fallback={<LoadingState />}><Municipios /></Suspense>,
});

function Municipios() {
  const { data } = useSuspenseQuery(contractsQueryOptions());
  const filters = useFilters();
  const contracts = useMemo(() => applyFilters(data.contracts, filters), [data, filters]);
  const [selected, setSelected] = useState<string | null>(null);

  const populacaoTotal = contracts.reduce((s, c) => s + c.populacao, 0);
  const valorTotal = contracts.reduce((s, c) => s + c.valorContrato, 0);
  const ticketHabMedio = populacaoTotal > 0 ? valorTotal / populacaoTotal : 0;
  const areaTotal = contracts.reduce((s, c) => s + c.areaKm2, 0);
  const totalImoveis = contracts.reduce((s, c) => s + c.unidades, 0);
  const valorPorImovel = totalImoveis > 0 ? valorTotal / totalImoveis : 0;

  const scatterData = useMemo(
    () =>
      contracts
        .filter((c) => c.populacao > 0)
        .map((c) => ({
          x: c.populacao, y: c.valorContrato,
          municipio: c.municipio, uf: c.uf,
        })),
    [contracts],
  );

  const detalhe = selected
    ? contracts.find((c) => c.municipio === selected) ?? null
    : null;

  return (
    <PageShell
      title="Análise de Municípios"
      subtitle="População vs valor de contrato e drill-down por município"
    >
      <FiltersBar contracts={data.contracts} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Municípios" value={fmtInt(contracts.length)} />
        <KpiCard label="População Atendida" value={fmtInt(populacaoTotal)} hint="Soma de habitantes" />
        <KpiCard label="Imóveis" value={fmtInt(totalImoveis)} hint={`R$/imóvel: ${fmtBRL(valorPorImovel)}`} icon={<Home className="h-4 w-4" />} tone="accent" />
        <KpiCard label="Área Total" value={`${fmtInt(Math.round(areaTotal))} km²`} />
        <KpiCard label="R$ por habitante (média)" value={fmtBRL(ticketHabMedio)} />
      </div>

      <SectionCard title="População vs Valor do Contrato" description="Cada ponto = um município">
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ left: 30, bottom: 10 }}>
              <CartesianGrid stroke="oklch(0.92 0.012 250)" />
              <XAxis
                type="number" dataKey="x" name="População"
                tickFormatter={fmtInt} fontSize={11} stroke="oklch(0.50 0.03 255)"
              />
              <YAxis
                type="number" dataKey="y" name="Valor"
                tickFormatter={fmtBRLShort} fontSize={11} stroke="oklch(0.50 0.03 255)"
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) =>
                  name === "Valor" ? fmtBRL(value) : fmtInt(value)
                }
                labelFormatter={() => ""}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { municipio: string; uf: string; x: number; y: number };
                  return (
                    <div className="bg-card border rounded-md p-2 text-xs shadow-sm">
                      <div className="font-semibold">{p.municipio} <span className="text-muted-foreground">{p.uf}</span></div>
                      <div className="text-muted-foreground">Pop: {fmtInt(p.x)}</div>
                      <div className="text-muted-foreground">Valor: {fmtBRL(p.y)}</div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} fill="oklch(0.55 0.12 245)" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Catálogo de Municípios" description="Clique em um município para ver detalhes">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                  <th className="py-2 pr-4">Município</th>
                  <th className="py-2 pr-4">UF</th>
                  <th className="py-2 pr-4 text-right">Pop.</th>
                  <th className="py-2 pr-4 text-right">Valor</th>
                  <th className="py-2 pr-4 text-right">R$/hab</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr
                    key={`${c.numero}-${c.municipio}`}
                    className={"border-b border-border/40 cursor-pointer hover:bg-muted/40 " + (selected === c.municipio ? "bg-accent/10" : "")}
                    onClick={() => setSelected(c.municipio)}
                  >
                    <td className="py-2 pr-4 font-medium">{c.municipio}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.uf}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtInt(c.populacao)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtBRLShort(c.valorContrato)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {c.ticketPorHabitante > 0 ? fmtBRL(c.ticketPorHabitante) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border rounded-lg p-4 bg-muted/20 max-h-[500px] overflow-y-auto">
            {!detalhe ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Selecione um município para ver detalhes
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase text-muted-foreground tracking-wider">Município</div>
                  <div className="text-base font-semibold">{detalhe.municipio} — {detalhe.uf}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Contrato:</span> <div className="font-medium">{detalhe.contrato}</div></div>
                  <div><span className="text-muted-foreground">Vencimento:</span> <div className="font-medium">{fmtDate(detalhe.vencimento)}</div></div>
                  <div><span className="text-muted-foreground">Valor:</span> <div className="font-medium">{fmtBRL(detalhe.valorContrato)}</div></div>
                  <div><span className="text-muted-foreground">População:</span> <div className="font-medium">{fmtInt(detalhe.populacao)}</div></div>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-xs uppercase text-muted-foreground tracking-wider mb-2">Serviços Contratados</div>
                  <ul className="space-y-1">
                    {SERVICE_LINES.filter((l) => detalhe.receitaPorLinha[l] > 0).map((l) => (
                      <li key={l} className="flex justify-between text-xs">
                        <span>{l}</span>
                        <span className="tabular-nums font-medium">{fmtBRLShort(detalhe.receitaPorLinha[l])}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}