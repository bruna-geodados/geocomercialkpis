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
  prazoMaxAditivos: Date | null;
  prazoMax60meses: Date | null;
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

type DateOrder = "AUTO" | "BR" | "US";

/** Parses spreadsheet dates without allowing JS date overflow to swap days/months. */
export function parseSheetDate(raw: unknown, order: DateOrder = "AUTO"): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || s === "-") return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, mo, d] = iso;
    return makeDate(Number(y), Number(mo), Number(d));
  }
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    const resolved =
      order === "BR" || (order === "AUTO" && a > 12)
        ? { day: a, month: b }
        : order === "US" || (order === "AUTO" && b > 12)
          ? { day: b, month: a }
          : { day: b, month: a };
    return makeDate(year, resolved.month, resolved.day);
  }
  return null;
}

function makeDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function col(header: readonly string[], label: string, fallback: number): number {
  const wanted = normalizeHeader(label);
  const found = header.findIndex((h) => normalizeHeader(h) === wanted);
  return found >= 0 ? found : fallback;
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
  order: DateOrder = "AUTO",
): { count: number; datas: Date[] } {
  const datas: Date[] = [];
  let count = 0;
  for (const [dateIdx, valueIdx] of pairs) {
    const valor = num(row, valueIdx);
    const dt = parseSheetDate(row[dateIdx], order);
    if (valor > 0 || dt) {
      count += 1;
      if (dt) datas.push(dt);
    }
  }
  return { count, datas };
}

const NOVA_TA_PAIRS: Array<[number, number]> = [[8, 9], [10, 11], [12, 13]];
const ATA_TA_PAIRS: Array<[number, number]> = [[9, 10], [11, 12]];
// "Aditivos vigentes" tab has 8 TA pairs (cols J..Y → indices 9..24)
const ANT_TA_PAIRS: Array<[number, number]> = [
  [9, 10], [11, 12], [13, 14], [15, 16],
  [17, 18], [19, 20], [21, 22], [23, 24],
];

// --- Column indexes (0-based), derived from row 2 of the sheet ---
// ============================================================
// Nova gestão tab — 3 TA columns. A coluna "Valor máximo aditivos (25%)"
// que ficava logo após "Valor do contrato" foi removida da planilha, então
// todos os índices a partir de 8 deslocam -1 em relação à versão anterior.
// ============================================================
// 0 Nº | 1 Município | 2 População | 3 Contrato | 4 Data | 5 Vigência inicial
// 6 Projeção | 7 Valor do contrato
// 8/9 1º TA | 10/11 2º TA | 12/13 3º TA
// 14 Vencimento atualizado | 15 Valor aditivado
// 16 Assinado Geodados | 17 Assinado Prefeitura
// 18 % Aditivado | 19 Valor máx aditivos (25%)
// 20 Área km² | 21 Unidades
// 22..25 Aero (drone, tripulado, km², satélite)
// 26 360º | 27 Atualização permanente
// 28..38 Cadastro Multifinalitário (11 cols)
// 39..42 PVG/Tributário | 43..44 Endereçamento
// 45..52 SIG Implantação | 53..60 SIG Licença | 61..68 SIG /Mensal
// 69..73 Desenvolvimento & Custom | 74 Taxa de Lixo
const NOVA = {
  valorContrato: 7,
  maxAdit: 20,
  vencimento: 14,
  prazoMaxAdit: 15,
  aditivado: 16,
  percAdit: 19,
  area: 21,
  unidades: 22,
  aero: [23, 24, 25, 26],
  m360: 27,
  atualPerm: 28,
  cadastro: [29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39],
  pvg: [40, 41, 42, 43],
  endereco: [44, 45],
  sigImpl: [46, 47, 48, 49, 50, 51, 52, 53],
  sigLic: [54, 55, 56, 57, 58, 59, 60, 61],
  sigMensal: [62, 63, 64, 65, 66, 67, 68, 69],
  dev: [70, 71, 72, 73, 74],
  taxaLixo: 75,
} as const;

// ============================================================
// Atas de registro - Nova gestão — like Nova gestão but with
// "Valor da Ata" (7) and "Valor contratado até o momento" (8) and
// only 2 TA pairs (cols J/K + L/M → 9/10 + 11/12).
// ============================================================
const ATA = {
  valorAta: 7,
  valorContrato: 8,
  maxAdit: 19,
  vencimento: 13,
  prazoMaxAdit: 14,
  aditivado: 15,
  percAdit: 18,
  area: 20,
  unidades: 21,
  aero: [22, 23, 24, 25],
  m360: 26,
  atualPerm: 27,
  cadastro: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38],
  pvg: [39, 40, 41, 42],
  endereco: [43, 44],
  sigImpl: [45, 46, 47, 48, 49, 50, 51, 52],
  sigLic: [53, 54, 55, 56, 57, 58, 59, 60],
  sigMensal: [61, 62, 63, 64, 65, 66, 67, 68],
  dev: [69, 70, 71, 72, 73],
  taxaLixo: 74,
} as const;

function buildNovaGestao(row: string[], header: string[]): Contract | null {
  if (!row || !row[1]) return null;
  const nRaw = String(row[0] ?? "").trim();
  if (!nRaw || !/^\d+/.test(nRaw)) return null;

  const { municipio, uf } = splitMunicipio(row[1]);
  const valorContrato = num(row, NOVA.valorContrato);
  if (valorContrato <= 0) return null; // skip rows without contract value

  const dataContrato = parseSheetDate(row[4]);
  const vigenciaInicial = parseSheetDate(row[5]);
  const vencimento = parseSheetDate(
    row[col(header, "Vencimento do contrato atualizado", NOVA.vencimento)],
    "BR",
  );

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

  const tas = countAditivosPairs(row, NOVA_TA_PAIRS, "BR");

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
function buildAta(row: string[], header: string[]): Contract | null {
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
  const vencimento = parseSheetDate(
    row[col(header, "Vencimento do contrato atualizado", ATA.vencimento)],
    "BR",
  );
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

  const tas = countAditivosPairs(row, ATA_TA_PAIRS, "BR");

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
// Gestão Anterior - Contratos aditivados (73 cols)
// Tab simplificada: SEM colunas de TA — só valor do contrato + vencimento.
// 0 Nº | 1 Município | 2 População | 3 Contrato | 4 Data | 5 Vigência inicial
// 6 Projeção | 7 Valor da Ata | 8 Valor do contrato
// 9 Vencimento atualizado | 10 Área km² | 11 Unidades
// 12-15 Aero (drone, tripulado, km², satélite)
// 16 360º | 17 Atualização permanente
// 18-36 Cadastro Multifinalitário (19 cols: Mapa Urbano, Uso/Ocup, Atual imob,
//   Digitaliz, Mapa Rural, Atual rural, Regul, Coleta, Posturas, Vias, Postes,
//   Arboriz, Águas, APP, Saúde, Educ, Assist, Mobiliário, Cemitério)
// 37-40 PVG | 41-42 Endereçamento
// 43-50 SIG Impl | 51-58 SIG Lic | 59-66 SIG Mensal
// 67-71 Desenvolvimento | 72 Taxa de Lixo
const ANT_AERO = [12, 13, 14, 15];
const ANT_CADASTRO = [
  18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
];
const ANT_PVG = [37, 38, 39, 40];
const ANT_ENDER = [41, 42];
const ANT_SIG_IMPL = [43, 44, 45, 46, 47, 48, 49, 50];
const ANT_SIG_LIC = [51, 52, 53, 54, 55, 56, 57, 58];
const ANT_SIG_MENSAL = [59, 60, 61, 62, 63, 64, 65, 66];
const ANT_DEV = [67, 68, 69, 70, 71];
const ANT_TAXA_LIXO = 72;

function buildGestaoAnterior(row: string[], header: string[]): Contract | null {
  if (!row || !row[1]) return null;
  const { municipio, uf } = splitMunicipio(row[1]);
  if (!municipio) return null;
  const valorContrato = num(row, 8);
  if (valorContrato <= 0) return null;

  const populacao = num(row, 2);
  const dataContrato = parseSheetDate(row[4]);
  const vigenciaInicial = parseSheetDate(row[5]);
  const vencimento = parseSheetDate(
    row[col(header, "Vencimento do contrato atualizado", 9)],
    "BR",
  );

  const receitaPorLinha: Record<ServiceLine, number> = {
    "Aerolevantamento": sumIndexes(row, ANT_AERO),
    "Mapeamento 360º": num(row, 16),
    "Atualização Permanente": num(row, 17),
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
  const unidades = num(row, 11);

  // ANT tab no longer has TA columns
  const tas = { count: 0, datas: [] as Date[] };

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
    valorAditivosMax: 0,
    valorAditivado: 0,
    percentualAditivado: 0,
    areaKm2: num(row, 10),
    unidades,
    receitaPorLinha,
    aero: {
      drone: num(row, ANT_AERO[0]),
      tripulado: num(row, ANT_AERO[1]),
      valorKm2: num(row, ANT_AERO[2]),
      satelite: num(row, ANT_AERO[3]),
    },
    aditivoVigente: { aeroDrone: 0, m360: 0, sigWebLicenca: 0, sigWebMensal: 0 },
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
  // 35 cols. Foco em AF-AI (índices 31-34: Aero drone, 360º, SIG Web Licença,
  // SIG Web/Mensal) + count de TAs (8 pares: J/K..X/Y) e vencimento atualizado
  // (Z = 25). Valor aditivado AA=26, Assinado Geodados AB=27, Prefeitura
  // AC=28, % Aditivada AD=29, Valor máx aditivos AE=30.
  // ============================================================
  function buildAditivosVigentes(row: string[], header: string[]): Contract | null {
    if (!row || !row[1]) return null;
    const { municipio, uf } = splitMunicipio(row[1]);
    if (!municipio) return null;
    const valorContrato = num(row, 8);
    const aeroDrone = num(row, 31);
    const m360 = num(row, 32);
    const sigWebLic = num(row, 33);
    const sigWebMensal = num(row, 34);
    const totalVig = aeroDrone + m360 + sigWebLic + sigWebMensal;
    if (totalVig <= 0 && valorContrato <= 0) return null;

    const dataContrato = parseSheetDate(row[4]);
    const vigenciaInicial = parseSheetDate(row[5]);
    const vencimento = parseSheetDate(
      row[col(header, "Vencimento do contrato atualizado", 25)],
      "BR",
    );
    const populacao = num(row, 2);
    const valorAditivado = num(row, 26);
    const percAdit = num(row, 29);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diasParaVencer = vencimento
      ? Math.round((vencimento.getTime() - today.getTime()) / 86400000)
      : 99999;
    let statusVencimento: Contract["statusVencimento"] = "saudavel";
    if (diasParaVencer < 0) statusVencimento = "vencido";
    else if (diasParaVencer <= 30) statusVencimento = "criticos";
    else if (diasParaVencer <= 90) statusVencimento = "atencao";

    const tas = countAditivosPairs(row, ANT_TA_PAIRS, "BR");
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
      valorAditivosMax: num(row, 30),
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
  const header = values[1] ?? [];
  return values
    .slice(2)
    .map((r) => builder(r, header))
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