import { defineMcp } from "@lovable.dev/mcp-js";
import listContracts from "./tools/list-contracts";
import getMunicipio from "./tools/get-municipio";
import revenueSummary from "./tools/revenue-summary";
import expiringContracts from "./tools/expiring-contracts";

export default defineMcp({
  name: "geocomercial-kpis-mcp",
  title: "GeoComercial KPIs MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas de leitura sobre o dashboard comercial (contratos municipais, receita por linha de serviço, vigências, SIG). Fonte: planilha Google Sheets sincronizada. Use `list_contracts` para listar/filtrar, `get_municipio` para detalhe de um município, `revenue_summary` para totais por linha de serviço e `expiring_contracts` para contratos próximos do vencimento.",
  tools: [listContracts, getMunicipio, revenueSummary, expiringContracts],
});