import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { contractsQueryOptions } from "@/lib/queries";
import { applyFilters, useFilters } from "@/lib/filters-store";
import { fmtBRL, fmtBRLShort, fmtInt, sigModuleAggregates, SIG_MODULES } from "@/lib/contracts";
import { Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/page-shell";
import { KpiCard } from "@/components/kpi-card";
import { FiltersBar } from "@/components/filters-bar";
import { SectionCard } from "@/components/section-card";
import { LoadingState } from "@/components/loading-state";

export const Route = createFileRoute("/sig")({
  loader: ({ context }) => context.queryClient.ensureQueryData(contractsQueryOptions()),
  component: () => <Suspense fallback={<LoadingState />}><SigPage /></Suspense>,
});

function SigPage() {
  const { data } = useSuspenseQuery(contractsQueryOptions());
  const filters = useFilters();
  const contracts = useMemo(() => applyFilters(data.contracts, filters), [data, filters]);

  const mrr = contracts.reduce((s, c) => s + c.mrrSig, 0);
  const implTotal = useMemo(
    () => contracts.reduce((s, c) => s + c.receitaPorLinha["SIG - Implantação"], 0),
    [contracts],
  );
  const licTotal = useMemo(
    () => contracts.reduce((s, c) => s + c.receitaPorLinha["SIG - Licenças"], 0),
    [contracts],
  );
  const clientesSig = contracts.filter((c) => c.contratosSig > 0).length;
  const totalImoveis = contracts.reduce((s, c) => s + c.unidades, 0);
  const mrrPorImovel = totalImoveis > 0 ? mrr / totalImoveis : 0;

  const dadosModulos = useMemo(() => {
    const impl = sigModuleAggregates(contracts, "implantacao");
    const lic = sigModuleAggregates(contracts, "licenca");
    const men = sigModuleAggregates(contracts, "mensal");
    return SIG_MODULES.map((m, i) => ({
      modulo: m,
      Implantação: impl[i].valor,
      Licença: lic[i].valor,
      Mensal: men[i].valor,
      municipios: lic[i].municipios,
    }));
  }, [contracts]);

  const oportunidades = useMemo(() => {
    // Para cada módulo SIG, listar municípios que NÃO contrataram
    return SIG_MODULES.map((mod) => {
      const semContrato = contracts.filter(
        (c) => (c.sigBreakdown.find((r) => r.modulo === mod)?.licenca ?? 0) === 0,
      );
      return { modulo: mod, qtdSem: semContrato.length };
    }).sort((a, b) => b.qtdSem - a.qtdSem);
  }, [contracts]);

  // SIG Web /Mensal — detalhamento por município
  const webMensalDetalhe = useMemo(
    () =>
      contracts
        .map((c) => ({
          municipio: c.municipio,
          uf: c.uf,
          gestao: c.gestao,
          webImpl: c.sigBreakdown[0]?.implantacao ?? 0,
          webLic: c.sigBreakdown[0]?.licenca ?? 0,
          webMensal: c.mrrSigWeb,
          mrrTotal: c.mrrSig,
        }))
        .filter((r) => r.webMensal > 0 || r.webLic > 0 || r.webImpl > 0)
        .sort((a, b) => b.webMensal - a.webMensal),
    [contracts],
  );
  const totalWebMensal = webMensalDetalhe.reduce((s, r) => s + r.webMensal, 0);
  const totalWebLic = webMensalDetalhe.reduce((s, r) => s + r.webLic, 0);
  const totalWebImpl = webMensalDetalhe.reduce((s, r) => s + r.webImpl, 0);

  return (
    <PageShell
      title="SIG & Licenças Recorrentes"
      subtitle="MRR, mix por módulo e oportunidades de upsell"
    >
      <FiltersBar contracts={data.contracts} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="MRR Total" value={fmtBRLShort(mrr)} hint={fmtBRL(mrr)} tone="success" />
        <KpiCard label="Implantação" value={fmtBRLShort(implTotal)} hint="Receita única (setup)" />
        <KpiCard label="Licenças" value={fmtBRLShort(licTotal)} hint="Licença anual" tone="accent" />
        <KpiCard label="Clientes SIG" value={fmtInt(clientesSig)} hint={`${contracts.length - clientesSig} sem nenhum módulo`} />
        <KpiCard label="MRR / imóvel" value={fmtBRL(mrrPorImovel)} hint={`${fmtInt(totalImoveis)} imóveis na carteira`} icon={<Home className="h-4 w-4" />} />
      </div>

      <SectionCard title="Mix por Módulo SIG" description="Implantação, Licença e Mensal por módulo">
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosModulos}>
              <CartesianGrid stroke="oklch(0.92 0.012 250)" />
              <XAxis dataKey="modulo" fontSize={11} stroke="oklch(0.50 0.03 255)" />
              <YAxis tickFormatter={fmtBRLShort} fontSize={11} stroke="oklch(0.50 0.03 255)" />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Implantação" fill="oklch(0.28 0.08 255)" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Licença" fill="oklch(0.55 0.12 245)" stackId="a" />
              <Bar dataKey="Mensal" fill="oklch(0.68 0.10 220)" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="SIG Web / Mensal — detalhamento"
        description={`MRR Web: ${fmtBRL(totalWebMensal)} · Licença Web: ${fmtBRL(totalWebLic)} · Implantação Web: ${fmtBRL(totalWebImpl)}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Município</th>
                <th className="py-2 pr-4">UF</th>
                <th className="py-2 pr-4">Gestão</th>
                <th className="py-2 pr-4 text-right">SIG Web Implantação</th>
                <th className="py-2 pr-4 text-right">SIG Web Licença</th>
                <th className="py-2 pr-4 text-right">SIG Web/Mensal</th>
                <th className="py-2 pr-4 text-right">% do MRR total</th>
              </tr>
            </thead>
            <tbody>
              {webMensalDetalhe.map((r) => (
                <tr key={r.municipio + r.uf + r.gestao} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2.5 pr-4 font-medium">{r.municipio}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{r.uf}</td>
                  <td className="py-2.5 pr-4">
                    <Badge variant={r.gestao === "nova" ? "default" : "secondary"} className="text-[10px]">
                      {r.gestao === "nova" ? "Nova" : "Anterior"}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r.webImpl > 0 ? fmtBRL(r.webImpl) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r.webLic > 0 ? fmtBRL(r.webLic) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-[oklch(0.55_0.14_155)]">
                    {r.webMensal > 0 ? fmtBRL(r.webMensal) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                    {r.mrrTotal > 0 ? `${((r.webMensal / r.mrrTotal) * 100).toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))}
              {webMensalDetalhe.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    Nenhum município com SIG Web neste filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Adoção por Módulo" description="Quantos municípios usam cada módulo">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Módulo</th>
                <th className="py-2 pr-4 text-right">Municípios</th>
                <th className="py-2 pr-4 text-right">Adoção</th>
              </tr>
            </thead>
            <tbody>
              {dadosModulos.map((d) => (
                <tr key={d.modulo} className="border-b border-border/40">
                  <td className="py-2 pr-4 font-medium">{d.modulo}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{d.municipios}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {contracts.length ? ((d.municipios / contracts.length) * 100).toFixed(0) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Oportunidades de Upsell" description="Módulos com mais municípios sem contrato">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Módulo</th>
                <th className="py-2 pr-4 text-right">Municípios sem</th>
                <th className="py-2 pr-4 text-right">% da carteira</th>
              </tr>
            </thead>
            <tbody>
              {oportunidades.map((o) => (
                <tr key={o.modulo} className="border-b border-border/40">
                  <td className="py-2 pr-4 font-medium">{o.modulo}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    <span className="text-[oklch(0.55_0.14_155)] font-medium">{o.qtdSem}</span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {contracts.length ? ((o.qtdSem / contracts.length) * 100).toFixed(0) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </PageShell>
  );
}