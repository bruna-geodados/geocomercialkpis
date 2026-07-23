import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadContracts } from "@/lib/sheets.server";

export default defineTool({
  name: "expiring_contracts",
  title: "Contratos a vencer",
  description:
    "Lista contratos que vencem nos próximos N dias (padrão 180), ordenados do mais próximo ao mais distante. Inclui contratos já vencidos por padrão.",
  inputSchema: {
    diasHorizonte: z.number().int().min(1).max(3650).default(180),
    incluirVencidos: z.boolean().default(true),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ diasHorizonte, incluirVencidos }) => {
    const { contracts, fetchedAt } = await loadContracts();
    const rows = contracts
      .filter((c) => c.vencimento !== null)
      .filter((c) => (incluirVencidos ? true : c.diasParaVencer >= 0))
      .filter((c) => c.diasParaVencer <= diasHorizonte)
      .sort((a, b) => a.diasParaVencer - b.diasParaVencer)
      .map((c) => ({
        municipio: c.municipio,
        uf: c.uf,
        gestao: c.gestao,
        contrato: c.contrato,
        vencimento: c.vencimento?.toISOString() ?? null,
        diasParaVencer: c.diasParaVencer,
        statusVencimento: c.statusVencimento,
        valorContrato: c.valorContrato,
      }));
    return {
      content: [{ type: "text", text: JSON.stringify({ fetchedAt, total: rows.length, rows }, null, 2) }],
      structuredContent: { fetchedAt, total: rows.length, rows },
    };
  },
});