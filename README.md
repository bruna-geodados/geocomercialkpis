# Sales Insights Hub

Dashboard comercial (KPIs de contratos municipais) conectado em tempo real à
planilha do Google Sheets:

https://docs.google.com/spreadsheets/d/1GLGSTS7a8bnLiwUjq-u3EN09Fi_is1KzCDdbcZTOy0A

Os dados são buscados diretamente da Google Sheets API v4 (sem intermediário)
a cada carregamento de página e a cada 15s em segundo plano
(`src/lib/queries.ts`), então qualquer edição na planilha aparece no
dashboard automaticamente, sem nenhum passo manual de "republicar" ou
"exportar".

## Conectar ao Google Sheets

O dashboard lê a planilha via uma **API Key do Google Cloud restrita à
Google Sheets API**. Isso exige que a planilha esteja com o link de
visualização aberto ("Qualquer pessoa com o link pode visualizar") — sem
isso a API Key não consegue ler os dados.

1. **Compartilhar a planilha para leitura pública**
   - Na planilha → botão **Compartilhar** (canto superior direito) →
     em "Acesso geral" selecione **Qualquer pessoa com o link** → papel
     **Leitor**.
2. **Criar a API Key no Google Cloud**
   - Acesse https://console.cloud.google.com/ → crie um projeto (ou use um
     existente).
   - Vá em **APIs e serviços → Biblioteca**, procure **Google Sheets API**
     e clique em **Ativar**.
   - Vá em **APIs e serviços → Credenciais → Criar credenciais → Chave de
     API**.
   - Clique na chave criada → em **Restrições de API**, selecione
     **Restringir chave** e marque apenas **Google Sheets API** (evita que
     a chave sirva para outras APIs caso vaze).
3. **Configurar a chave no projeto**
   - Local (dev): copie `.env.example` para `.env` e cole a chave em
     `GOOGLE_SHEETS_API_KEY`.
   - Produção (Vercel): projeto → **Settings → Environment Variables** →
     adicione `GOOGLE_SHEETS_API_KEY` com o mesmo valor.

Como a planilha fica com link de visualização aberto, qualquer pessoa com a
URL consegue ver os dados brutos diretamente no Google Sheets — isso é uma
troca consciente pela simplicidade de não precisar de OAuth/Service
Account. Se depois quiser manter a planilha privada, dá para migrar para
autenticação por Service Account (compartilhando a planilha só com o
e-mail da conta de serviço) sem mudar o resto do dashboard — avise que eu
faço a troca.

This project was originally scaffolded with [Lovable](https://lovable.dev) and
is now deployed independently on Vercel.

## Deploy (Vercel)

The build is preconfigured for Vercel via Nitro's `vercel` preset
(`vite.config.ts`) — no extra setup beyond connecting the repo:

1. Import the repository on https://vercel.com/new.
2. Framework preset: Vercel auto-detects the build output (Nitro emits a
   Build Output API v3 bundle), no manual override needed.
3. Add the `GOOGLE_SHEETS_API_KEY` environment variable (see above) in
   **Settings → Environment Variables** before the first deploy.
4. Deploy. Every push to the connected branch redeploys automatically.

To build the same output locally (sanity check before pushing):

```sh
bun run build
# inspect .vercel/output/ — Build Output API v3 structure
```

## Development

You need Node.js/Bun. Copy `.env.example` to `.env` and fill in
`GOOGLE_SHEETS_API_KEY` first (see "Conectar ao Google Sheets" above).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```
