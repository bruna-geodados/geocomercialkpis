import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadContracts } from "@/lib/sheets.server";

export default defineTool({
  name: "get_municipio",
  title: "Detalhe do município",
  description:
    "Retorna todos os contratos (nova/anterior/aditivo/ata) associados a um município, com breakdown SIG, aero, locação e receita por linha.",
  inputSchema: {
    municipio: z.string().min(1).describe("Nome do município (case-insensitive)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ municipio }) => {
    const { contracts, fetchedAt } = await loadContracts();
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const q = norm(municipio);
    const rows = contracts.filter((c) => norm(c.municipio) === q);
    return {
      content: [
        {
          type: "text",
          text: rows.length
            ? JSON.stringify({ fetchedAt, municipio, contratos: rows }, null, 2)
            : `Nenhum contrato encontrado para "${municipio}".`,
        },
      ],
      structuredContent: { fetchedAt, municipio, contratos: rows },
      isError: rows.length === 0,
    };
  },
});