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
   - Local (dev): copie `.dev.vars.example` para `.dev.vars` e cole a chave
     em `GOOGLE_SHEETS_API_KEY`.
   - Produção (Cloudflare Workers): `wrangler secret put GOOGLE_SHEETS_API_KEY`.

Como a planilha fica com link de visualização aberto, qualquer pessoa com a
URL consegue ver os dados brutos diretamente no Google Sheets — isso é uma
troca consciente pela simplicidade de não precisar de OAuth/Service
Account. Se depois quiser manter a planilha privada, dá para migrar para
autenticação por Service Account (compartilhando a planilha só com o
e-mail da conta de serviço) sem mudar o resto do dashboard — avise que eu
faço a troca.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://geocomercialkpis.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/87b131b2-079e-4f82-951e-7474a455d3cd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
