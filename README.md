# Sales Insights Hub

om base nessa planilha eu preciso que vc contrua um dashboard dinamico com KPIS - integrado com o planilhas google, para análise do setor comercial da empresa, criação no Lovable.

Estrutura de Dados — as 12 colunas obrigatórias na planilha com tipos e observações, mais os 5 campos calculados que o frontend vai gerar automaticamente.

Páginas — detalhamento das 5 páginas com os KPIs e gráficos de cada uma.

Arquitetura Técnica — stack React + TypeScript, como publicar a planilha como CSV e o fluxo fetch → parse → enrich → render.

Prompt Lovable — o prompt completo e detalhado, pronto para colar. Ele já instrui o Lovable a criar: hook de dados, store de filtros globais, todas as 5 páginas, mapa do Brasil, exportação CSV e formatação BR.

Antes de colar no Lovable, faça isso:

No Google Sheets → Arquivo → Compartilhar → Publicar na web → selecione a aba de dados → formato CSV → copie a URL

No prompt, substitua [URL_DA_PLANILHA] por essa URL

Se me compartilhar a planilha com acesso público, consigo revisar se as colunas reais batem com a estrutura e ajustar o prompt antes de você levar pro Lovable.

A planilha é a seguinte: 

https://docs.google.com/spreadsheets/d/1GLGSTS7a8bnLiwUjq-u3EN09Fi_is1KzCDdbcZTOy0A/edit?gid=1791401717#gid=1791401717

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
