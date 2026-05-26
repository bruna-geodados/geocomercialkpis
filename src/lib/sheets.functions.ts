import { createServerFn } from "@tanstack/react-start";
import { parseSheetValues, type Contract } from "./contracts";

const SPREADSHEET_ID = "1GLGSTS7a8bnLiwUjq-u3EN09Fi_is1KzCDdbcZTOy0A";
const RANGE = "'Nova gestão '!A1:BX200";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const fetchContracts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ contracts: Contract[]; fetchedAt: string }> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    if (!GOOGLE_SHEETS_API_KEY)
      throw new Error("GOOGLE_SHEETS_API_KEY not configured");

    const url = `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}`;
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
    const data = (await res.json()) as { values?: string[][] };
    const contracts = parseSheetValues(data.values ?? []);
    return { contracts, fetchedAt: new Date().toISOString() };
  },
);