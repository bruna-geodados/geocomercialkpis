import { createServerFn } from "@tanstack/react-start";
import { parseSheet, type Contract } from "./contracts";

const SPREADSHEET_ID = "1GLGSTS7a8bnLiwUjq-u3EN09Fi_is1KzCDdbcZTOy0A";
const RANGE_NOVA = "Nova gestão !A1:BX300";
const RANGE_ATAS = "Atas de registro - Nova gestão!A1:BX300";
const RANGE_ANT = "Gestão anterior - Aditivados!A1:CA300";
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
    params.append("ranges", RANGE_ATAS);
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
      (r) => r.range.includes("Nova gest") && !r.range.includes("Atas"),
    );
    const atasRange = ranges.find((r) => r.range.includes("Atas"));
    const antRange = ranges.find((r) => r.range.includes("anterior"));
    const contracts = [
      ...parseSheet(novaRange?.values ?? [], "nova"),
      ...parseSheet(atasRange?.values ?? [], "ata"),
      ...parseSheet(antRange?.values ?? [], "anterior"),
    ];
    return { contracts, fetchedAt: new Date().toISOString() };
  },
);