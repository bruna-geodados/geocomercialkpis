// Domain types and parsing helpers for the comercial dashboard.
// The Google Sheet has 2 header rows; row 1 = category group, row 2 = field name.
// We hard-code the column positions because the sheet layout is fixed.

export type ServiceLine =
  | "Aerolevantamento"
  | "Mapeamento 360º"
  | "Atualização Permanente"
  | "Cadastro Multifinalitário"
  | "PVG / Tributário"
  | "Endereçamento Postal"
  | "SIG - Implantação"
  | "SIG - Licenças"
  | "SIG - Mensal (MRR)"
  | "Desenvolvimento & Custom"
  | "Taxa de Lixo";

export interface Contract {
  numero: number;
  municipio: string;
  uf: string;
  populacao: number;
  contrato: string;
  dataContrato: Date | null;
  vigenciaInicial: Date | null;
  vencimento: Date | null;
  valorAta: number;
  valorContrato: number;
  valorAditivosMax: number;
  valorAditivado: number;
  percentualAditivado: number; // 0..1
  areaKm2: number;
  unidades: number;
  // Receita por linha de serviço
  receitaPorLinha: Record<ServiceLine, number>;
  // Campos calculados
  ticketPorHabitante: number;
  diasParaVencer: number; // negativo se vencido
  statusVencimento: "vencido" | "criticos" | "atencao" | "saudavel";
  mrrSig: number; // soma das licenças /Mensal
  contratosSig: number; // qtd de módulos SIG contratados
  sigBreakdown: {
    modulo: string;
    implantacao: number;
    licenca: number;
    mensal: number;
  }[];
}

const BR_UF = new Set([
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
]);

export function splitMunicipio(raw: string): { municipio: string; uf: string } {
  if (!raw) return { municipio: "", uf: "" };
  const m = raw.match(/^(.+?)\s*-\s*([A-Z]{2})\s*$/);
  if (m && BR_UF.has(m[2])) return { municipio: m[1].trim(), uf: m[2] };
  return { municipio: raw.trim(), uf: "" };
}

/** Parses BR currency / numbers — "R$ 1.234,56" → 1234.56. Empty / "-" → 0. */
export function parseBRNumber(raw: unknown): number {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s || s === "-" || s === "—") return 0;
  // strip everything except digits, comma, dot, minus
  const cleaned = s
    .replace(/[Rr]\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Parses dates in M/D/YYYY (US) or D/M/YYYY (BR) — sheet uses M/D/YYYY. */
export function parseSheetDate(raw: unknown): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || s === "-") return null;
  // M/D/YYYY (sheet default)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function num(row: string[], i: number): number {
  return parseBRNumber(row[i]);
}

function sumIndexes(row: string[], indexes: number[]): number {
  return indexes.reduce((acc, i) => acc + num(row, i), 0);
}

// --- Column indexes (0-based), derived from row 2 of the sheet ---
// 0 Nº | 1 Município | 2 População | 3 Contrato | 4 Data contrato
// 5 Vigência inicial | 6 Projeção prorrogação | 7 Valor da Ata | 8 Valor do contrato
// 9 Valor máx aditivos | 10 1º TA | 12 2º TA | 14 Vencimento atualizado
// 15 Valor aditivado | 16 % Aditivado | 17 Valor máx aditivos
// 18 Área km² | 19 Unidades/Imóveis
// 20 Aero drone | 21 Aero tripulado | 22 Aero Valor | 23 Imagem satélite
// 24 360º | 25 Atualização permanente
// 26..36 Mapa Base / Cadastro Multifinalitário (Mapa Urbano, Atualização cadastro,
//   Mapa Rural, Atualização Rural, Regularização, Coleta in loco, Posturas,
//   Vias, Postes, Arborização, Mobiliário)
// 37 PVG | 38 PVG Rural | 39 Código Tributário | 40 Assessoria Tributária
// 41 Plano Numeração | 42 Placas
// 43..50 SIG implantação (Web, Mobile, Fiscalização, Fisc IA, Alvará, Viabilidade, Rastreamento, Cidadão)
// 51..58 SIG Licença (mesma ordem)
// 59..66 SIG /Mensal (mesma ordem)
// 67 Desenvolvimento/hora Web | 68 Desenvolvimento/hora Mobile
// 69 Locação smartphone | 70 Parametrizações | 71 Adequação evolutiva
// 72 Reformulação Taxa Lixo

const CADASTRO_IDX = [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
const PVG_IDX = [37, 38, 39, 40];
const ENDERECO_IDX = [41, 42];
const SIG_IMPL_IDX = [43, 44, 45, 46, 47, 48, 49, 50];
const SIG_LIC_IDX = [51, 52, 53, 54, 55, 56, 57, 58];
const SIG_MENSAL_IDX = [59, 60, 61, 62, 63, 64, 65, 66];
const DEV_IDX = [67, 68, 69, 70, 71];
const AERO_IDX = [20, 21, 22, 23];

export function buildContract(row: string[]): Contract | null {
  if (!row || !row[1]) return null;
  const nRaw = String(row[0] ?? "").trim();
  if (!nRaw || !/^\d+/.test(nRaw)) return null;

  const { municipio, uf } = splitMunicipio(row[1]);
  const valorContrato = num(row, 8);
  if (valorContrato <= 0) return null; // skip rows without contract value

  const dataContrato = parseSheetDate(row[4]);
  const vigenciaInicial = parseSheetDate(row[5]);
  const vencimento = parseSheetDate(row[14]) ?? parseSheetDate(row[10]);

  const populacao = num(row, 2);

  const receitaPorLinha: Record<ServiceLine, number> = {
    "Aerolevantamento": sumIndexes(row, AERO_IDX),
    "Mapeamento 360º": num(row, 24),
    "Atualização Permanente": num(row, 25),
    "Cadastro Multifinalitário": sumIndexes(row, CADASTRO_IDX),
    "PVG / Tributário": sumIndexes(row, PVG_IDX),
    "Endereçamento Postal": sumIndexes(row, ENDERECO_IDX),
    "SIG - Implantação": sumIndexes(row, SIG_IMPL_IDX),
    "SIG - Licenças": sumIndexes(row, SIG_LIC_IDX),
    "SIG - Mensal (MRR)": sumIndexes(row, SIG_MENSAL_IDX),
    "Desenvolvimento & Custom": sumIndexes(row, DEV_IDX),
    "Taxa de Lixo": num(row, 72),
  };

  const mrrSig = receitaPorLinha["SIG - Mensal (MRR)"];
  const contratosSig = SIG_LIC_IDX.filter((i) => num(row, i) > 0).length;

  const sigBreakdown = SIG_MODULES.map((modulo, i) => ({
    modulo,
    implantacao: num(row, SIG_IMPL_IDX[i]),
    licenca: num(row, SIG_LIC_IDX[i]),
    mensal: num(row, SIG_MENSAL_IDX[i]),
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diasParaVencer = vencimento
    ? Math.round((vencimento.getTime() - today.getTime()) / 86400000)
    : 99999;

  let statusVencimento: Contract["statusVencimento"] = "saudavel";
  if (diasParaVencer < 0) statusVencimento = "vencido";
  else if (diasParaVencer <= 30) statusVencimento = "criticos";
  else if (diasParaVencer <= 90) statusVencimento = "atencao";

  return {
    numero: Number(nRaw.match(/^\d+/)?.[0] ?? 0),
    municipio,
    uf,
    populacao,
    contrato: String(row[3] ?? "").trim(),
    dataContrato,
    vigenciaInicial,
    vencimento,
    valorAta: num(row, 7),
    valorContrato,
    valorAditivosMax: num(row, 9),
    valorAditivado: num(row, 15),
    percentualAditivado: num(row, 16) > 1 ? num(row, 16) / 100 : num(row, 16),
    areaKm2: num(row, 18),
    unidades: num(row, 19),
    receitaPorLinha,
    ticketPorHabitante: populacao > 0 ? valorContrato / populacao : 0,
    diasParaVencer,
    statusVencimento,
    mrrSig,
    contratosSig,
    sigBreakdown,
  };
}

export function parseSheetValues(values: string[][]): Contract[] {
  // Skip the 2 header rows
  return values
    .slice(2)
    .map((r) => buildContract(r))
    .filter((c): c is Contract => c !== null);
}

// --- formatting helpers ---
export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export const fmtBRLShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return fmtBRL(n);
};

export const fmtInt = (n: number) => n.toLocaleString("pt-BR");

export const fmtPct = (n: number) =>
  `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("pt-BR") : "—";

export const SERVICE_LINES: ServiceLine[] = [
  "Aerolevantamento",
  "Mapeamento 360º",
  "Atualização Permanente",
  "Cadastro Multifinalitário",
  "PVG / Tributário",
  "Endereçamento Postal",
  "SIG - Implantação",
  "SIG - Licenças",
  "SIG - Mensal (MRR)",
  "Desenvolvimento & Custom",
  "Taxa de Lixo",
];

export const SIG_MODULES = [
  "Web",
  "Mobile",
  "Fiscalização",
  "Fiscalização IA",
  "Alvará",
  "Viabilidade",
  "Rastreamento",
  "Cidadão",
] as const;

export function sigModuleAggregates(
  contracts: Contract[],
  kind: "implantacao" | "licenca" | "mensal",
): { modulo: string; valor: number; municipios: number }[] {
  return SIG_MODULES.map((modulo) => {
    let valor = 0;
    let municipios = 0;
    for (const c of contracts) {
      const row = c.sigBreakdown.find((r) => r.modulo === modulo);
      if (!row) continue;
      const v = row[kind];
      if (v > 0) {
        valor += v;
        municipios += 1;
      }
    }
    return { modulo, valor, municipios };
  });
}