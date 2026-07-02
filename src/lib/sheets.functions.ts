import { createServerFn } from "@tanstack/react-start";
import { parseSheet, type Contract } from "./contracts";

const SPREADSHEET_ID = "1GLGSTS7a8bnLiwUjq-u3EN09Fi_is1KzCDdbcZTOy0A";
const RANGE_NOVA = "Gestão atual - Contratos!A:ZZ";
const RANGE_ADIT_ATUAL = "Gestão atual - Aditivos!A:ZZ";
const RANGE_ATAS = "Gestão atual -Atas de Registro de Preço!A:ZZ";
const RANGE_VIG = "Gestão anterior - Aditivos vigentes!A:ZZ";
const RANGE_ANT = "Gestão Anterior - Contratos aditivados!A:ZZ";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const fetchContracts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ contracts: Contract[]; fetchedAt: string }> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    if (!GOOGLE_SHEETS_API_KEY)
      throw new Error("GOOGLE_SHEETS_API_KEY not configured");

    const params = new URLSearchParams();
    params.append("ranges", RANGE_NOVA);
    params.append("ranges", RANGE_ADIT_ATUAL);
    params.append("ranges", RANGE_ATAS);
    params.append("ranges", RANGE_VIG);
    params.append("ranges", RANGE_ANT);
    const url = `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets gateway error [${res.status}]: ${body}`);
    }
    const data = (await res.json()) as {
      valueRanges?: { range: string; values?: string[][] }[];
    };
    const ranges = data.valueRanges ?? [];
    const novaRange = ranges.find(
      (r) => r.range.includes("atual - Contratos"),
    );
    const aditAtualRange = ranges.find((r) => r.range.includes("atual - Aditivos"));
    const atasRange = ranges.find((r) => r.range.includes("Atas de Registro"));
    const vigRange = ranges.find((r) => r.range.includes("Aditivos vigentes"));
    const antRange = ranges.find((r) => r.range.includes("Contratos aditivados"));
    const novaContracts = parseSheet(novaRange?.values ?? [], "nova");
    const aditAtualContracts = parseSheet(aditAtualRange?.values ?? [], "aditivo-atual");

    // Regra de negócio: SIG Web Licença / SIG Web/Mensal presentes em
    // "Gestão atual - Aditivos" substituem (não somam) os valores originais
    // em "Gestão atual - Contratos" para o mesmo município. Evita dupla
    // contagem quando o recebimento migra para o aditivo.
    const keyOf = (m: string) =>
      m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const sigOverrides = new Map<string, { lic: number; mensal: number }>();
    for (const a of aditAtualContracts) {
      const lic = a.aditivoVigente.sigWebLicenca;
      const mensal = a.aditivoVigente.sigWebMensal;
      if (lic > 0 || mensal > 0) {
        sigOverrides.set(keyOf(a.municipio), { lic, mensal });
      }
    }
    for (const c of novaContracts) {
      const ov = sigOverrides.get(keyOf(c.municipio));
      if (!ov) continue;
      if (ov.lic > 0 && c.sigBreakdown[0]) {
        const prev = c.sigBreakdown[0].licenca;
        c.sigBreakdown[0].licenca = 0;
        c.receitaPorLinha["SIG - Licenças"] = Math.max(
          0,
          c.receitaPorLinha["SIG - Licenças"] - prev,
        );
      }
      if (ov.mensal > 0 && c.sigBreakdown[0]) {
        const prev = c.sigBreakdown[0].mensal;
        c.sigBreakdown[0].mensal = 0;
        c.receitaPorLinha["SIG - Mensal (MRR)"] = Math.max(
          0,
          c.receitaPorLinha["SIG - Mensal (MRR)"] - prev,
        );
        c.mrrSig = Math.max(0, c.mrrSig - prev);
        c.mrrSigWeb = 0;
      }
    }

    const contracts = [
      ...novaContracts,
      ...aditAtualContracts,
      ...parseSheet(atasRange?.values ?? [], "ata"),
      ...parseSheet(vigRange?.values ?? [], "vigente"),
      ...parseSheet(antRange?.values ?? [], "anterior"),
    ];
    return { contracts, fetchedAt: new Date().toISOString() };
  },
);