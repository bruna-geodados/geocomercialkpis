// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Deploy target: Vercel. Nitro's "vercel" preset builds the .vercel/output
// structure Vercel expects; TanStack Start's default bundled server entry
// is used (no custom Cloudflare Workers fetch(request, env, ctx) wrapper).
export default defineConfig({
  nitro: { preset: "vercel" },
  vite: {
    plugins: [mcpPlugin()],
    // @lovable.dev/mcp-js dynamically imports "cloudflare:workers" as an
    // optional, try/catch-guarded fallback for reading env vars on Cloudflare
    // Workers. It never resolves outside that runtime, but bundlers still try
    // to resolve it statically — externalize it so the Vercel build doesn't
    // fail trying.
    build: { rollupOptions: { external: ["cloudflare:workers"] } },
  },
});
