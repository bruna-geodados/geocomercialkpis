import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { contractsQueryOptions } from "@/lib/queries";
import { applyFilters, useFilters } from "@/lib/filters-store";
import { fmtBRL, fmtBRLShort, fmtInt, sigModuleAggregates, SIG_MODULES } from "@/lib/contracts";
import type { Contract } from "@/lib/contracts";
import { Users } from "lucide-react";
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
  const allContracts = useMemo(() => applyFilters(data.contracts, filters), [data, filters]);
  // Exclui Atas de Registro dos agregados — categoria separada.
  const contracts = useMemo(() => allContracts.filter((c) => c.gestao !== "ata"), [allContracts]);

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
  // População total dos municípios com contrato SIG ativo (MRR > 0).
  const populacaoSig = contracts
    .filter((c) => c.mrrSig > 0)
    .reduce((s, c) => s + c.populacao, 0);
  const mrrPorHab = populacaoSig > 0 ? mrr / populacaoSig : 0;
  // Valor total dos contratos SIG (impl + lic + mensal) ÷ população vinculada
  const valorSigTotal = implTotal + licTotal + mrr;
  const populacaoSigQualquer = contracts
    .filter((c) => c.receitaPorLinha["SIG - Implantação"] + c.receitaPorLinha["SIG - Licenças"] + c.mrrSig > 0)
    .reduce((s, c) => s + c.populacao, 0);
  const sigPorHab = populacaoSigQualquer > 0 ? valorSigTotal / populacaoSigQualquer : 0;

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
          populacao: c.populacao,
          mrrPorHab: c.populacao > 0 ? c.mrrSig / c.populacao : 0,
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
      <FiltersBar contracts={data.contracts} gestaoOptions={["nova", "vigente", "all"]} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="MRR Total" value={fmtBRLShort(mrr)} hint={fmtBRL(mrr)} tone="success" />
        <KpiCard label="Implantação" value={fmtBRLShort(implTotal)} hint="Receita única (setup)" />
        <KpiCard label="Licenças" value={fmtBRLShort(licTotal)} hint="Licença anual" tone="accent" />
        <KpiCard label="Clientes SIG" value={fmtInt(clientesSig)} hint={`${contracts.length - clientesSig} sem nenhum módulo`} />
        <KpiCard label="MRR R$/hab" value={fmtBRL(mrrPorHab)} hint={`${fmtInt(populacaoSig)} hab. com SIG ativo`} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="SIG R$/hab" value={fmtBRL(sigPorHab)} hint={`Impl + Licença + Mensal ÷ população`} tone="accent" icon={<Users className="h-4 w-4" />} />
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
                <th className="py-2 pr-4 text-right">MRR R$/hab</th>
                <th className="py-2 pr-4 text-right">População</th>
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
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r.mrrPorHab > 0 ? fmtBRL(r.mrrPorHab) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                    {r.populacao > 0 ? fmtInt(r.populacao) : "—"}
                  </td>
                </tr>
              ))}
              {webMensalDetalhe.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Nenhum município com SIG Web neste filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ModulosDetalhe contracts={contracts} />
      <LocacaoSection contracts={contracts} />
      <ParametrizacoesSection contracts={contracts} />

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

const NON_WEB_MODULES = SIG_MODULES.filter((m) => m !== "Web");

function ModulosDetalhe({ contracts }: { contracts: Contract[] }) {
  const rows = NON_WEB_MODULES.flatMap((modulo) =>
    contracts
      .map((c) => {
        const b = c.sigBreakdown.find((r) => r.modulo === modulo);
        if (!b) return null;
        if (b.implantacao === 0 && b.licenca === 0 && b.mensal === 0) return null;
        return {
          modulo,
          municipio: c.municipio,
          uf: c.uf,
          gestao: c.gestao,
          impl: b.implantacao,
          lic: b.licenca,
          mensal: b.mensal,
          key: `${modulo}-${c.municipio}-${c.uf}-${c.gestao}`,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.lic + b.impl - (a.lic + a.impl)),
  );
  const totalImpl = rows.reduce((s, r) => s + r.impl, 0);
  const totalLic = rows.reduce((s, r) => s + r.lic, 0);
  const totalMensal = rows.reduce((s, r) => s + r.mensal, 0);

  return (
    <SectionCard
      title="Demais módulos SIG — detalhamento por município"
      description={`Mobile, Fiscalização, IA, Alvará, Viabilidade, Rastreamento, Cidadão · Impl: ${fmtBRL(totalImpl)} · Licença: ${fmtBRL(totalLic)} · Mensal: ${fmtBRL(totalMensal)}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <th className="py-2 pr-4">Módulo</th>
              <th className="py-2 pr-4">Município</th>
              <th className="py-2 pr-4">UF</th>
              <th className="py-2 pr-4 text-right">Implantação</th>
              <th className="py-2 pr-4 text-right">Licença</th>
              <th className="py-2 pr-4 text-right">Mensal (MRR)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-2.5 pr-4 font-medium">{r.modulo}</td>
                <td className="py-2.5 pr-4">{r.municipio}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">{r.uf}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{r.impl > 0 ? fmtBRL(r.impl) : "—"}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{r.lic > 0 ? fmtBRL(r.lic) : "—"}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-[oklch(0.55_0.14_155)]">{r.mensal > 0 ? fmtBRL(r.mensal) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Nenhum município com módulos SIG (fora Web) neste filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function LocacaoSection({ contracts }: { contracts: Contract[] }) {
  const rows = contracts
    .map((c) => ({
      key: `${c.municipio}-${c.uf}-${c.gestao}`,
      municipio: c.municipio,
      uf: c.uf,
      ...c.locacao,
      totalMensal: c.locacao.smartMensal + c.locacao.imprMensal + c.locacao.comboMensal,
    }))
    .filter(
      (r) =>
        r.smartImpl + r.smartMensal + r.imprImpl + r.imprMensal + r.comboImpl + r.comboMensal > 0,
    )
    .sort((a, b) => b.totalMensal - a.totalMensal);
  const tot = rows.reduce(
    (s, r) => ({
      smartImpl: s.smartImpl + r.smartImpl,
      smartMensal: s.smartMensal + r.smartMensal,
      imprImpl: s.imprImpl + r.imprImpl,
      imprMensal: s.imprMensal + r.imprMensal,
      comboImpl: s.comboImpl + r.comboImpl,
      comboMensal: s.comboMensal + r.comboMensal,
    }),
    { smartImpl: 0, smartMensal: 0, imprImpl: 0, imprMensal: 0, comboImpl: 0, comboMensal: 0 },
  );
  const totalMensal = tot.smartMensal + tot.imprMensal + tot.comboMensal;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Locação — Mensal Total" value={fmtBRL(totalMensal)} tone="success" hint="Smartphone + Impressora + Combo" />
        <KpiCard label="Smartphone /Mensal" value={fmtBRL(tot.smartMensal)} hint={`Implantação: ${fmtBRL(tot.smartImpl)}`} />
        <KpiCard label="Impressora Térmica /Mensal" value={fmtBRL(tot.imprMensal)} hint={`Implantação: ${fmtBRL(tot.imprImpl)}`} />
        <KpiCard label="Combo /Mensal" value={fmtBRL(tot.comboMensal)} hint={`Implantação: ${fmtBRL(tot.comboImpl)}`} tone="accent" />
      </div>
      <SectionCard
        title="Locação de equipamentos — detalhamento por município"
        description="Smartphones Mobile, Impressoras Térmicas e Combo (implantação + valor mensal)"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Município</th>
                <th className="py-2 pr-4">UF</th>
                <th className="py-2 pr-4 text-right">Smart Impl.</th>
                <th className="py-2 pr-4 text-right">Smart /Mensal</th>
                <th className="py-2 pr-4 text-right">Impr. Impl.</th>
                <th className="py-2 pr-4 text-right">Impr. /Mensal</th>
                <th className="py-2 pr-4 text-right">Combo Impl.</th>
                <th className="py-2 pr-4 text-right">Combo /Mensal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2.5 pr-4 font-medium">{r.municipio}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{r.uf}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{r.smartImpl > 0 ? fmtBRL(r.smartImpl) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{r.smartMensal > 0 ? fmtBRL(r.smartMensal) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{r.imprImpl > 0 ? fmtBRL(r.imprImpl) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{r.imprMensal > 0 ? fmtBRL(r.imprMensal) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{r.comboImpl > 0 ? fmtBRL(r.comboImpl) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-[oklch(0.55_0.14_155)]">{r.comboMensal > 0 ? fmtBRL(r.comboMensal) : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Nenhum município com locação de equipamentos neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

function ParametrizacoesSection({ contracts }: { contracts: Contract[] }) {
  const rows = contracts
    .map((c) => ({
      key: `${c.municipio}-${c.uf}-${c.gestao}`,
      municipio: c.municipio,
      uf: c.uf,
      param: c.parametrizacoes.parametrizacoes,
      adeq: c.parametrizacoes.adequacaoTecnica,
    }))
    .filter((r) => r.param > 0 || r.adeq > 0)
    .sort((a, b) => b.param + b.adeq - (a.param + a.adeq));
  const totalParam = rows.reduce((s, r) => s + r.param, 0);
  const totalAdeq = rows.reduce((s, r) => s + r.adeq, 0);

  return (
    <SectionCard
      title="Parametrizações e integrações"
      description={`Parametrizações: ${fmtBRL(totalParam)} · Adequação técnica evolutiva: ${fmtBRL(totalAdeq)}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <th className="py-2 pr-4">Município</th>
              <th className="py-2 pr-4">UF</th>
              <th className="py-2 pr-4 text-right">Parametrizações e integrações</th>
              <th className="py-2 pr-4 text-right">Adequação técnica evolutiva</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-2.5 pr-4 font-medium">{r.municipio}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">{r.uf}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{r.param > 0 ? fmtBRL(r.param) : "—"}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{r.adeq > 0 ? fmtBRL(r.adeq) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Nenhum município com parametrizações neste filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}