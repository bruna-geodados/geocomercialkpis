import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { contractsQueryOptions } from "@/lib/queries";
import { applyFilters, useFilters } from "@/lib/filters-store";
import { fmtBRL, fmtBRLShort, SERVICE_LINES, type ServiceLine } from "@/lib/contracts";
import { PageShell } from "@/components/page-shell";
import { KpiCard } from "@/components/kpi-card";
import { FiltersBar } from "@/components/filters-bar";
import { SectionCard } from "@/components/section-card";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export const Route = createFileRoute("/receita")({
  loader: ({ context }) => context.queryClient.ensureQueryData(contractsQueryOptions()),
  component: () => (
    <Suspense fallback={<LoadingState />}><Receita /></Suspense>
  ),
});

function Receita() {
  const { data } = useSuspenseQuery(contractsQueryOptions());
  const filters = useFilters();
  const allContracts = useMemo(() => applyFilters(data.contracts, filters), [data, filters]);
  // Atas de Registro de Preço são tratadas como categoria separada e NÃO entram
  // nos totais nem nos gráficos agregados das demais linhas de serviço.
  const contracts = useMemo(() => allContracts.filter((c) => c.gestao !== "ata"), [allContracts]);
  type Aba = "Todos" | ServiceLine;
  const [linhaSelecionada, setLinhaSelecionada] = useState<Aba>("Todos");

  const totalGeral = contracts.reduce((s, c) => s + c.valorContrato, 0);
  const totalImoveis = contracts.reduce((s, c) => s + c.unidades, 0);
  const valorPorImovel = totalImoveis > 0 ? totalGeral / totalImoveis : 0;

  const porLinha = useMemo(
    () =>
      SERVICE_LINES.map((linha) => ({
        linha,
        valor: contracts.reduce((s, c) => s + c.receitaPorLinha[linha], 0),
        municipios: contracts.filter((c) => c.receitaPorLinha[linha] > 0).length,
      })).sort((a, b) => b.valor - a.valor),
    [contracts],
  );

  const rankingMunicipios = useMemo(() => {
    if (linhaSelecionada === "Todos") {
      // Agrupa todos os serviços por município — valor total do contrato.
      const map = new Map<string, { municipio: string; uf: string; valor: number }>();
      for (const c of contracts) {
        const key = `${c.municipio}__${c.uf}`;
        const prev = map.get(key);
        if (prev) prev.valor += c.valorContrato;
        else map.set(key, { municipio: c.municipio, uf: c.uf, valor: c.valorContrato });
      }
      return Array.from(map.values())
        .filter((r) => r.valor > 0)
        .sort((a, b) => b.valor - a.valor);
    }
    return contracts
      .map((c) => ({
        municipio: c.municipio,
        uf: c.uf,
        valor: c.receitaPorLinha[linhaSelecionada],
      }))
      .filter((r) => r.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [contracts, linhaSelecionada]);

  const top3 = porLinha.slice(0, 3);

  return (
    <PageShell
      title="Receita por Linha de Serviço"
      subtitle="Quanto cada vertical representa da carteira"
    >
      <FiltersBar contracts={data.contracts} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {top3.map((r, i) => (
          <KpiCard
            key={r.linha}
            label={`#${i + 1} · ${r.linha}`}
            value={fmtBRLShort(r.valor)}
            hint={`${r.municipios} municípios · ${((r.valor / totalGeral) * 100).toFixed(1)}% da carteira`}
            tone={i === 0 ? "accent" : "default"}
          />
        ))}
        <KpiCard
          label="Imóveis na carteira"
          value={totalImoveis.toLocaleString("pt-BR")}
          hint={`R$/imóvel médio: ${fmtBRL(valorPorImovel)}`}
          icon={<Home className="h-4 w-4" />}
        />
      </div>

      <SectionCard title="Faturamento por Linha de Serviço">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porLinha} layout="vertical" margin={{ left: 50 }}>
              <CartesianGrid horizontal={false} stroke="oklch(0.92 0.012 250)" />
              <XAxis type="number" tickFormatter={fmtBRLShort} fontSize={11} stroke="oklch(0.50 0.03 255)" />
              <YAxis type="category" dataKey="linha" fontSize={11} width={170} stroke="oklch(0.50 0.03 255)" />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="valor" fill="oklch(0.55 0.12 245)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="Ranking de Municípios por Linha"
        description={`${rankingMunicipios.length} municípios em "${linhaSelecionada}"`}
        action={
          <div className="flex flex-wrap gap-1 max-w-[60%] justify-end">
            {(["Todos", ...SERVICE_LINES] as Aba[]).map((l) => (
              <Button
                key={l}
                variant={l === linhaSelecionada ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setLinhaSelecionada(l)}
              >
                {l}
              </Button>
            ))}
          </div>
        }
      >
        {rankingMunicipios.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Nenhum município com receita nesta linha.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                  <th className="py-2 pr-4 w-8">#</th>
                  <th className="py-2 pr-4">Município</th>
                  <th className="py-2 pr-4">UF</th>
                  <th className="py-2 pr-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rankingMunicipios.map((r, i) => (
                  <tr key={r.municipio} className="border-b border-border/40">
                    <td className="py-2 pr-4 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium">{r.municipio}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.uf}</td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium">{fmtBRL(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}