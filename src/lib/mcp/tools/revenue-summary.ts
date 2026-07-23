import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadContracts } from "@/lib/sheets.server";

export default defineTool({
  name: "revenue_summary",
  title: "Resumo de receita por linha de serviço",
  description:
    "Soma a receita por linha de serviço (Aerolevantamento, SIG, Cadastro, etc.) em todos os contratos, ou filtrando por gestão. Atas ficam de fora dos totais agregados.",
  inputSchema: {
    gestao: z
      .enum(["nova", "anterior", "vigente", "aditivo-atual", "todas"])
      .default("todas"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ gestao }) => {
    const { contracts, fetchedAt } = await loadContracts();
    const filtered = contracts
      .filter((c) => c.gestao !== "ata")
      .filter((c) => gestao === "todas" || c.gestao === gestao);
    const totals: Record<string, number> = {};
    let valorContratoTotal = 0;
    let mrrSigTotal = 0;
    for (const c of filtered) {
      valorContratoTotal += c.valorContrato;
      mrrSigTotal += c.mrrSig;
      for (const [k, v] of Object.entries(c.receitaPorLinha)) {
        totals[k] = (totals[k] ?? 0) + v;
      }
    }
    const payload = {
      fetchedAt,
      gestao,
      contratos: filtered.length,
      valorContratoTotal,
      mrrSigTotal,
      receitaPorLinha: totals,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});