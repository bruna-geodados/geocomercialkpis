## 1. Renomeações de abas (UI)

- `FiltersBar` (e onde aparecer label): **"Nova Gestão" → "Gestão Atual"** e **"Aditivos Vigentes" → "Gestão Anterior - Aditivos"**.
- Manter os valores internos `gestao: "nova" | "vigente" | "anterior" | "ata" | "aditivo-atual"` (apenas labels mudam) para não quebrar filtros existentes.

## 2. Nova aba do dashboard: "Gestão Atual - Aditivos"

- Adicionar item no `app-sidebar.tsx` apontando para nova rota `/aditivos-atual`.
- Nova rota `src/routes/aditivos-atual.tsx` no mesmo padrão das demais (PageShell + KPIs + tabela): lista contratos lidos da nova aba da planilha com colunas: Município, Contrato, Vencimento, Prazo máx aditivos, Valor aditivado, Aero, 360º, SIG Web Licença, SIG Web/Mensal.
- Adicionar a opção `"aditivo-atual"` ao tipo `gestao` em `Contract` e tornar disponível em `FiltersBar` (apenas em páginas que fizer sentido — inicialmente só receita/visao geral via "Todas").

## 3. Parser da nova aba (Google Sheets)

- Em `src/lib/sheets.functions.ts`: adicionar range `"Gestão atual - Aditivos!A:ZZ"` ao batchGet.
- Em `src/lib/contracts.ts`: criar `buildAditivoAtual(row, header)` com mapeamento:
  - 0 Nº, 1 Município, 2 População, 3 Contrato, 4 Data, 5 Vig.inicial,
  - 7 Valor contrato (base/original),
  - 8/9 1ºTA, 10/11 2ºTA, 12/13 3ºTA,
  - 14 Vencimento atualizado, 15 Prazo máx aditivos,
  - 16 Valor aditivado, 19 %Aditivado, 20 Valor máx (25%),
  - 21 Aero drone (km²), 22 360º (R$), 23 SIG Web Licença (R$), 24 SIG Web/Mensal (R$).
- Resolver coluna por header normalizado (robusto a inserções), com fallback de índice.
- Popular `aditivoVigente.{aeroDrone, m360, sigWebLicenca, sigWebMensal}` e `receitaPorLinha["SIG - Licenças"|"SIG - Mensal (MRR)"|"Mapeamento 360º"|"Aerolevantamento"]`.

## 4. Regra de substituição SIG (item 10)

- Em `queries.ts` (após parse): para cada `municipio` que tenha contrato `gestao="nova"` **e** registro `gestao="aditivo-atual"` com `sigWebLicenca>0` ou `sigWebMensal>0`:
  - Zerar no contrato `nova`: `sigBreakdown[0].licenca`, `sigBreakdown[0].mensal`, `mrrSig`, `mrrSigWeb`, `receitaPorLinha["SIG - Licenças"]`, `receitaPorLinha["SIG - Mensal (MRR)"]` correspondentes.
  - Manter `receitaPorLinha` do registro aditivo intacto.

## 5. SIG & Licenças — coluna População (item 4)

- Em `src/routes/sig.tsx`: adicionar coluna "População" entre "MRR R$/hab" e a anterior, com `c.populacao.toLocaleString("pt-BR")`. Atualizar `colSpan` do empty state.

## 6. Contratos & Vigências (itens 5 e 6)

- Em `src/routes/vigencias.tsx`:
  - Nova coluna **"Valor Aditivado"** (lendo `c.valorAditivado`).
  - Para "Prazo máx. aditivos" / "Prazo máx. 60 meses": calcular se cada coluna tem ao menos um valor; ocultar coluna totalmente vazia. Para cada linha onde ambos existem, manter apenas "Prazo máx. aditivos".

## 7. Visão Geral (itens 7 e 8)

- Em `src/routes/index.tsx` (e/ou onde aparecer "% Aditivado"): remover esse KPI/coluna.
- Adicionar colunas/KPIs por município: **Área (km²)** = `c.areaKm2`; **R$/km²** = `c.valorContrato / c.areaKm2` (guard divisão por zero).

## 8. Auto-atualização da planilha

- Já existe `useQuery` com `refetchInterval` (`live-refresh-indicator`). Manter; o parser por header (`col(header,...)`) já permite inserir novas colunas sem reprogramar.

## 9. Arquivos a alterar/criar

- editar: `src/lib/sheets.functions.ts`, `src/lib/contracts.ts`, `src/lib/queries.ts`, `src/components/filters-bar.tsx`, `src/components/app-sidebar.tsx`, `src/routes/sig.tsx`, `src/routes/vigencias.tsx`, `src/routes/index.tsx`
- criar: `src/routes/aditivos-atual.tsx`

## 10. Fora de escopo neste PR

- Mapeamento totalmente "schemaless" via UI: o parser ganha robustez de header, mas mapear automaticamente colunas totalmente novas para componentes do dashboard ainda exige edição de código (mantenho `col(header, label, fallback)` para minimizar isso).
