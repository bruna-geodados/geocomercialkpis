import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadContracts } from "@/lib/sheets.server";

export default defineTool({
  name: "list_contracts",
  title: "Listar contratos",
  description:
    "Lista contratos municipais do dashboard, com filtros opcionais por gestão, UF ou busca por município. Retorna campos-chave (valor, vencimento, MRR SIG, aditivos).",
  inputSchema: {
    gestao: z
      .enum(["nova", "anterior", "ata", "vigente", "aditivo-atual"])
      .optional()
      .describe("Filtro por tipo de gestão."),
    uf: z.string().length(2).optional().describe("Sigla do estado (ex: SP)."),
    search: z
      .string()
      .optional()
      .describe("Substring case-insensitive no nome do município."),
    limit: z.number().int().min(1).max(500).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ gestao, uf, search, limit }) => {
    const { contracts, fetchedAt } = await loadContracts();
    const q = search?.toLowerCase();
    const rows = contracts
      .filter((c) => !gestao || c.gestao === gestao)
      .filter((c) => !uf || c.uf.toUpperCase() === uf.toUpperCase())
      .filter((c) => !q || c.municipio.toLowerCase().includes(q))
      .slice(0, limit)
      .map((c) => ({
        municipio: c.municipio,
        uf: c.uf,
        gestao: c.gestao,
        contrato: c.contrato,
        populacao: c.populacao,
        valorContrato: c.valorContrato,
        valorAditivado: c.valorAditivado,
        vencimento: c.vencimento?.toISOString() ?? null,
        diasParaVencer: c.diasParaVencer,
        statusVencimento: c.statusVencimento,
        mrrSig: c.mrrSig,
        countAditivos: c.countAditivos,
      }));
    return {
      content: [{ type: "text", text: JSON.stringify({ fetchedAt, total: rows.length, rows }, null, 2) }],
      structuredContent: { fetchedAt, total: rows.length, rows },
    };
  },
});