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
  gestao: "nova" | "anterior" | "ata" | "vigente";
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
  // Breakdown de Aerolevantamento
  aero: {
    drone: number;
    tripulado: number;
    valorKm2: number;
    satelite: number;
  };
  // Aditivos vigentes — específico da Gestão Anterior (colunas AB-AE)
  aditivoVigente: {
    aeroDrone: number;       // AB
    m360: number;            // AC
    sigWebLicenca: number;   // AD
    sigWebMensal: number;    // AE
  };
  // Quantidade de aditivos firmados (TAs com valor preenchido)
  countAditivos: number;
  // Datas dos TAs firmados (para timeline)
  datasAditivos: Date[];
  // Campos calculados
  ticketPorHabitante: number;
  ticketPorImovel: number;
  diasParaVencer: number; // negativo se vencido
  statusVencimento: "vencido" | "criticos" | "atencao" | "saudavel";
  mrrSig: number; // soma das licenças /Mensal
  mrrSigWeb: number; // só SIG Web /Mensal
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

/** Counts aditivos firmados — pairs of (date, value); valor > 0 ⇒ firmado. */
function countAditivosPairs(
  row: string[],
  pairs: Array<[number, number]>,
): { count: number; datas: Date[] } {
  const datas: Date[] = [];
  let count = 0;
  for (const [dateIdx, valueIdx] of pairs) {
    const valor = num(row, valueIdx);
    const dt = parseSheetDate(row[dateIdx]);
    if (valor > 0 || dt) {
      count += 1;
      if (dt) datas.push(dt);
    }
  }
  return { count, datas };
}

const NOVA_TA_PAIRS: Array<[number, number]> = [[9, 10], [11, 12], [13, 14]];
const ATA_TA_PAIRS: Array<[number, number]> = [[10, 11], [12, 13]];
const ANT_TA_PAIRS: Array<[number, number]> = [
  [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22],
];

// --- Column indexes (0-based), derived from row 2 of the sheet ---
// ============================================================
// Nova gestão tab (74 cols) — 3 TA columns (added 3º TA)
// ============================================================
// 0 Nº | 1 Município | 2 População | 3 Contrato | 4 Data | 5 Vigência inicial
// 6 Projeção | 7 Valor do contrato | 8 Valor máx aditivos
// 9/10 1º TA | 11/12 2º TA | 13/14 3º TA | 15 Vencimento atualizado
// 16 Valor aditivado | 17 % Aditivado | 18 Valor máx aditivos
// 19 Área km² | 20 Unidades
// 21..24 Aero (drone, tripulado, km², satélite)
// 25 360º | 26 Atualização permanente
// 27..37 Cadastro Multifinalitário (11 cols)
// 38..41 PVG/Tributário | 42..43 Endereçamento
// 44..51 SIG Implantação | 52..59 SIG Licença | 60..67 SIG /Mensal
// 68..72 Desenvolvimento & Custom | 73 Taxa de Lixo
const NOVA = {
  valorContrato: 7,
  maxAdit: 8,
  vencimento: 15,
  aditivado: 16,
  percAdit: 17,
  area: 19,
  unidades: 20,
  aero: [21, 22, 23, 24],
  m360: 25,
  atualPerm: 26,
  cadastro: [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37],
  pvg: [38, 39, 40, 41],
  endereco: [42, 43],
  sigImpl: [44, 45, 46, 47, 48, 49, 50, 51],
  sigLic: [52, 53, 54, 55, 56, 57, 58, 59],
  sigMensal: [60, 61, 62, 63, 64, 65, 66, 67],
  dev: [68, 69, 70, 71, 72],
  taxaLixo: 73,
} as const;

// ============================================================
// Atas de registro - Nova gestão (73 cols) — same as Nova gestão
// but with both "Valor da Ata" (7) and "Valor contratado" (8).
// All indices ≥ 8 shift +1.
// ============================================================
const ATA = {
  valorAta: 7,
  valorContrato: 8,
  maxAdit: 9,
  vencimento: 14,
  aditivado: 15,
  percAdit: 16,
  area: 18,
  unidades: 19,
  aero: [20, 21, 22, 23],
  m360: 24,
  atualPerm: 25,
  cadastro: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
  pvg: [37, 38, 39, 40],
  endereco: [41, 42],
  sigImpl: [43, 44, 45, 46, 47, 48, 49, 50],
  sigLic: [51, 52, 53, 54, 55, 56, 57, 58],
  sigMensal: [59, 60, 61, 62, 63, 64, 65, 66],
  dev: [67, 68, 69, 70, 71],
  taxaLixo: 72,
} as const;

function buildNovaGestao(row: string[]): Contract | null {
  if (!row || !row[1]) return null;
  const nRaw = String(row[0] ?? "").trim();
  if (!nRaw || !/^\d+/.test(nRaw)) return null;

  const { municipio, uf } = splitMunicipio(row[1]);
  const valorContrato = num(row, NOVA.valorContrato);
  if (valorContrato <= 0) return null; // skip rows without contract value

  const dataContrato = parseSheetDate(row[4]);
  const vigenciaInicial = parseSheetDate(row[5]);
  const vencimento =
    parseSheetDate(row[NOVA.vencimento]) ??
    parseSheetDate(row[13]) ??
    parseSheetDate(row[11]) ??
    parseSheetDate(row[9]);

  const populacao = num(row, 2);

  const receitaPorLinha: Record<ServiceLine, number> = {
    "Aerolevantamento": sumIndexes(row, [...NOVA.aero]),
    "Mapeamento 360º": num(row, NOVA.m360),
    "Atualização Permanente": num(row, NOVA.atualPerm),
    "Cadastro Multifinalitário": sumIndexes(row, [...NOVA.cadastro]),
    "PVG / Tributário": sumIndexes(row, [...NOVA.pvg]),
    "Endereçamento Postal": sumIndexes(row, [...NOVA.endereco]),
    "SIG - Implantação": sumIndexes(row, [...NOVA.sigImpl]),
    "SIG - Licenças": sumIndexes(row, [...NOVA.sigLic]),
    "SIG - Mensal (MRR)": sumIndexes(row, [...NOVA.sigMensal]),
    "Desenvolvimento & Custom": sumIndexes(row, [...NOVA.dev]),
    "Taxa de Lixo": num(row, NOVA.taxaLixo),
  };

  const mrrSig = receitaPorLinha["SIG - Mensal (MRR)"];
  const contratosSig = NOVA.sigLic.filter((i) => num(row, i) > 0).length;

  const sigBreakdown = SIG_MODULES.map((modulo, i) => ({
    modulo,
    implantacao: num(row, NOVA.sigImpl[i]),
    licenca: num(row, NOVA.sigLic[i]),
    mensal: num(row, NOVA.sigMensal[i]),
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

  const tas = countAditivosPairs(row, NOVA_TA_PAIRS);

  return {
    gestao: "nova",
    numero: Number(nRaw.match(/^\d+/)?.[0] ?? 0),
    municipio,
    uf,
    populacao,
    contrato: String(row[3] ?? "").trim(),
    dataContrato,
    vigenciaInicial,
    vencimento,
    valorAta: 0,
    valorContrato,
    valorAditivosMax: num(row, NOVA.maxAdit),
    valorAditivado: num(row, NOVA.aditivado),
    percentualAditivado:
      num(row, NOVA.percAdit) > 1
        ? num(row, NOVA.percAdit) / 100
        : num(row, NOVA.percAdit),
    areaKm2: num(row, NOVA.area),
    unidades: num(row, NOVA.unidades),
    receitaPorLinha,
    aero: {
      drone: num(row, NOVA.aero[0]),
      tripulado: num(row, NOVA.aero[1]),
      valorKm2: num(row, NOVA.aero[2]),
      satelite: num(row, NOVA.aero[3]),
    },
    aditivoVigente: { aeroDrone: 0, m360: 0, sigWebLicenca: 0, sigWebMensal: 0 },
    countAditivos: tas.count,
    datasAditivos: tas.datas,
    ticketPorHabitante: populacao > 0 ? valorContrato / populacao : 0,
    ticketPorImovel: num(row, NOVA.unidades) > 0 ? valorContrato / num(row, NOVA.unidades) : 0,
    diasParaVencer,
    statusVencimento,
    mrrSig,
    mrrSigWeb: num(row, NOVA.sigMensal[0]),
    contratosSig,
    sigBreakdown,
  };
}

// ============================================================
// Atas de registro - Nova gestão builder
// (full unit prices per service; populates Aero breakdown
// that Nova gestão omits)
// ============================================================
function buildAta(row: string[]): Contract | null {
  if (!row || !row[1]) return null;
  const nRaw = String(row[0] ?? "").trim();
  if (!nRaw || !/^\d+/.test(nRaw)) return null;

  const { municipio, uf } = splitMunicipio(row[1]);
  const valorAta = num(row, ATA.valorAta);
  const valorContratado = num(row, ATA.valorContrato);
  const valorContrato = valorAta || valorContratado;
  if (valorContrato <= 0) return null;

  const dataContrato = parseSheetDate(row[4]);
  const vigenciaInicial = parseSheetDate(row[5]);
  const vencimento =
    parseSheetDate(row[ATA.vencimento]) ?? parseSheetDate(row[11]);
  const populacao = num(row, 2);

  const receitaPorLinha: Record<ServiceLine, number> = {
    "Aerolevantamento": sumIndexes(row, [...ATA.aero]),
    "Mapeamento 360º": num(row, ATA.m360),
    "Atualização Permanente": num(row, ATA.atualPerm),
    "Cadastro Multifinalitário": sumIndexes(row, [...ATA.cadastro]),
    "PVG / Tributário": sumIndexes(row, [...ATA.pvg]),
    "Endereçamento Postal": sumIndexes(row, [...ATA.endereco]),
    "SIG - Implantação": sumIndexes(row, [...ATA.sigImpl]),
    "SIG - Licenças": sumIndexes(row, [...ATA.sigLic]),
    "SIG - Mensal (MRR)": sumIndexes(row, [...ATA.sigMensal]),
    "Desenvolvimento & Custom": sumIndexes(row, [...ATA.dev]),
    "Taxa de Lixo": num(row, ATA.taxaLixo),
  };

  const mrrSig = receitaPorLinha["SIG - Mensal (MRR)"];
  const contratosSig = ATA.sigLic.filter((i) => num(row, i) > 0).length;
  const sigBreakdown = SIG_MODULES.map((modulo, i) => ({
    modulo,
    implantacao: num(row, ATA.sigImpl[i]),
    licenca: num(row, ATA.sigLic[i]),
    mensal: num(row, ATA.sigMensal[i]),
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

  const tas = countAditivosPairs(row, ATA_TA_PAIRS);

  return {
    gestao: "ata",
    numero: Number(nRaw.match(/^\d+/)?.[0] ?? 0),
    municipio,
    uf,
    populacao,
    contrato: String(row[3] ?? "").trim(),
    dataContrato,
    vigenciaInicial,
    vencimento,
    valorAta,
    valorContrato,
    valorAditivosMax: num(row, ATA.maxAdit),
    valorAditivado: num(row, ATA.aditivado),
    percentualAditivado:
      num(row, ATA.percAdit) > 1
        ? num(row, ATA.percAdit) / 100
        : num(row, ATA.percAdit),
    areaKm2: num(row, ATA.area),
    unidades: num(row, ATA.unidades),
    receitaPorLinha,
    aero: {
      drone: num(row, ATA.aero[0]),
      tripulado: num(row, ATA.aero[1]),
      valorKm2: num(row, ATA.aero[2]),
      satelite: num(row, ATA.aero[3]),
    },
    aditivoVigente: { aeroDrone: 0, m360: 0, sigWebLicenca: 0, sigWebMensal: 0 },
    countAditivos: tas.count,
    datasAditivos: tas.datas,
    ticketPorHabitante: populacao > 0 ? valorContrato / populacao : 0,
    ticketPorImovel: num(row, ATA.unidades) > 0 ? valorContrato / num(row, ATA.unidades) : 0,
    diasParaVencer,
    statusVencimento,
    mrrSig,
    mrrSigWeb: num(row, ATA.sigMensal[0]),
    contratosSig,
    sigBreakdown,
  };
}

// ============================================================
// Gestão Anterior - Aditivados (94 cols, real spreadsheet schema)
// 0 Nº | 1 Município | 2 População | 3 Contrato | 4 Data | 5 Vigência inicial
// 7 H  Valor da Ata | 8 I Valor do contrato
// 9-22 J-W Aditivos TA pairs
// 23 X Vencimento atualizado | 24 Y Valor aditivado | 25 Z % Aditivada
// 26 AA Valor máx aditivos
// --- Aditivos VIGENTES (em destaque) ---
// 27 AB Aero drone (aditivo) | 28 AC 360º (aditivo)
// 29 AD SIG Web Licença (aditivo) | 30 AE SIG Web/Mensal (aditivo)
// --- Quantitativos ---
// 31 AF Área km² | 32 AG Quantidade de imóveis
// --- Receita por linha ---
// 33-36 AH-AK Aero (drone, tripulado, km², satélite)
// 37 AL 360º | 38 AM Atualização permanente
// 39-57 AN-BF Cadastro Multifinalitário (19 cols: Mapa Urbano + Uso/Ocup +
//   17 itens cadastro: imobil, digitaliz, mapa rural, atual rural, regul,
//   coleta, posturas, vias, postes, arboriz, aguas pluv, app, saúde, edu,
//   assist, mobiliário, cemit)
// 58-61 BG-BJ PVG | 62-63 BK-BL Endereçamento
// 64-71 BM-BT SIG Impl | 72-79 BU-CB SIG Lic | 80-87 CC-CJ SIG Mensal
// 88-92 CK-CO Desenvolvimento | 93 CP Taxa de Lixo
const ANT_AERO = [33, 34, 35, 36];
const ANT_CADASTRO = [
  39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
];
const ANT_PVG = [58, 59, 60, 61];
const ANT_ENDER = [62, 63];
const ANT_SIG_IMPL = [64, 65, 66, 67, 68, 69, 70, 71];
const ANT_SIG_LIC = [72, 73, 74, 75, 76, 77, 78, 79];
const ANT_SIG_MENSAL = [80, 81, 82, 83, 84, 85, 86, 87];
const ANT_DEV = [88, 89, 90, 91, 92];
const ANT_TAXA_LIXO = 93;

function buildGestaoAnterior(row: string[]): Contract | null {
  if (!row || !row[1]) return null;
  const { municipio, uf } = splitMunicipio(row[1]);
  if (!municipio) return null;
  const valorContrato = num(row, 8);
  if (valorContrato <= 0) return null;

  const populacao = num(row, 2);
  const dataContrato = parseSheetDate(row[4]);
  const vigenciaInicial = parseSheetDate(row[5]);
  const vencimento = parseSheetDate(row[23]);

  const receitaPorLinha: Record<ServiceLine, number> = {
    "Aerolevantamento": sumIndexes(row, ANT_AERO),
    "Mapeamento 360º": num(row, 37),
    "Atualização Permanente": num(row, 38),
    "Cadastro Multifinalitário": sumIndexes(row, ANT_CADASTRO),
    "PVG / Tributário": sumIndexes(row, ANT_PVG),
    "Endereçamento Postal": sumIndexes(row, ANT_ENDER),
    "SIG - Implantação": sumIndexes(row, ANT_SIG_IMPL),
    "SIG - Licenças": sumIndexes(row, ANT_SIG_LIC),
    "SIG - Mensal (MRR)": sumIndexes(row, ANT_SIG_MENSAL),
    "Desenvolvimento & Custom": sumIndexes(row, ANT_DEV),
    "Taxa de Lixo": num(row, ANT_TAXA_LIXO),
  };

  const mrrSig = receitaPorLinha["SIG - Mensal (MRR)"];
  const contratosSig = ANT_SIG_LIC.filter((i) => num(row, i) > 0).length;

  const sigBreakdown = SIG_MODULES.map((modulo, i) => ({
    modulo,
    implantacao: num(row, ANT_SIG_IMPL[i]),
    licenca: num(row, ANT_SIG_LIC[i]),
    mensal: num(row, ANT_SIG_MENSAL[i]),
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

  const nRaw = String(row[0] ?? "").trim();
  const unidades = num(row, 32);

  const tas = countAditivosPairs(row, ANT_TA_PAIRS);

  return {
    gestao: "anterior",
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
    valorAditivosMax: num(row, 26),
    valorAditivado: num(row, 24),
    percentualAditivado: num(row, 25) > 1 ? num(row, 25) / 100 : num(row, 25),
    areaKm2: num(row, 31),
    unidades,
    receitaPorLinha,
    aero: {
      drone: num(row, ANT_AERO[0]),
      tripulado: num(row, ANT_AERO[1]),
      valorKm2: num(row, ANT_AERO[2]),
      satelite: num(row, ANT_AERO[3]),
    },
    aditivoVigente: {
      aeroDrone: num(row, 27),
      m360: num(row, 28),
      sigWebLicenca: num(row, 29),
      sigWebMensal: num(row, 30),
    },
    countAditivos: tas.count,
    datasAditivos: tas.datas,
    ticketPorHabitante: populacao > 0 ? valorContrato / populacao : 0,
    ticketPorImovel: unidades > 0 ? valorContrato / unidades : 0,
    diasParaVencer,
    statusVencimento,
    mrrSig,
    mrrSigWeb: num(row, ANT_SIG_MENSAL[0]),
    contratosSig,
    sigBreakdown,
  };
}

export function parseSheet(
  values: string[][],
  gestao: "nova" | "anterior" | "ata" | "vigente",
): Contract[] {
  // ============================================================
  // Inline: Aditivos Vigentes (tab "Gestão anterior - Aditivos vigentes")
  // 31 cols. Foco em AB-AE (índices 27-30) + count de TAs (7 pares) e
  // vencimento atualizado (X = 23).
  // ============================================================
  function buildAditivosVigentes(row: string[]): Contract | null {
    if (!row || !row[1]) return null;
    const { municipio, uf } = splitMunicipio(row[1]);
    if (!municipio) return null;
    const valorContrato = num(row, 8);
    const aeroDrone = num(row, 27);
    const m360 = num(row, 28);
    const sigWebLic = num(row, 29);
    const sigWebMensal = num(row, 30);
    const totalVig = aeroDrone + m360 + sigWebLic + sigWebMensal;
    if (totalVig <= 0 && valorContrato <= 0) return null;

    const dataContrato = parseSheetDate(row[4]);
    const vigenciaInicial = parseSheetDate(row[5]);
    const vencimento = parseSheetDate(row[23]);
    const populacao = num(row, 2);
    const valorAditivado = num(row, 24);
    const percAdit = num(row, 25);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diasParaVencer = vencimento
      ? Math.round((vencimento.getTime() - today.getTime()) / 86400000)
      : 99999;
    let statusVencimento: Contract["statusVencimento"] = "saudavel";
    if (diasParaVencer < 0) statusVencimento = "vencido";
    else if (diasParaVencer <= 30) statusVencimento = "criticos";
    else if (diasParaVencer <= 90) statusVencimento = "atencao";

    const tas = countAditivosPairs(row, ANT_TA_PAIRS);
    const nRaw = String(row[0] ?? "").trim();

    const receitaPorLinha: Record<ServiceLine, number> = {
      "Aerolevantamento": aeroDrone,
      "Mapeamento 360º": m360,
      "Atualização Permanente": 0,
      "Cadastro Multifinalitário": 0,
      "PVG / Tributário": 0,
      "Endereçamento Postal": 0,
      "SIG - Implantação": 0,
      "SIG - Licenças": sigWebLic,
      "SIG - Mensal (MRR)": sigWebMensal,
      "Desenvolvimento & Custom": 0,
      "Taxa de Lixo": 0,
    };

    return {
      gestao: "vigente",
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
      valorAditivosMax: num(row, 26),
      valorAditivado,
      percentualAditivado: percAdit > 1 ? percAdit / 100 : percAdit,
      areaKm2: 0,
      unidades: 0,
      receitaPorLinha,
      aero: { drone: aeroDrone, tripulado: 0, valorKm2: 0, satelite: 0 },
      aditivoVigente: {
        aeroDrone,
        m360,
        sigWebLicenca: sigWebLic,
        sigWebMensal,
      },
      countAditivos: tas.count,
      datasAditivos: tas.datas,
      ticketPorHabitante: populacao > 0 ? valorContrato / populacao : 0,
      ticketPorImovel: 0,
      diasParaVencer,
      statusVencimento,
      mrrSig: sigWebMensal,
      mrrSigWeb: sigWebMensal,
      contratosSig: sigWebLic > 0 ? 1 : 0,
      sigBreakdown: SIG_MODULES.map((modulo) => ({
        modulo,
        implantacao: 0,
        licenca: modulo === "Web" ? sigWebLic : 0,
        mensal: modulo === "Web" ? sigWebMensal : 0,
      })),
    };
  }

  const builder =
    gestao === "nova"
      ? buildNovaGestao
      : gestao === "ata"
        ? buildAta
        : gestao === "vigente"
          ? buildAditivosVigentes
          : buildGestaoAnterior;
  return values
    .slice(2)
    .map((r) => builder(r))
    .filter((c): c is Contract => c !== null);
}

// --- formatting helpers ---
export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtBRLShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(2)}k`;
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