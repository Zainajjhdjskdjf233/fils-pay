import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // FH: a proxy to :3000 would avoid the CORS/cookie dance, claude suggested it
  server: {
    port: 5173,
    // E61: same-origin API calls. The API sends no CORS headers (and should
    // not: cross-origin cookies are what client.ts warns about), so the dev
    // server forwards /v1 to the API. Hosting does the same with a reverse proxy.
    proxy: { "/v1": "http://localhost:3000", "/healthz": "http://localhost:3000", "/readyz": "http://localhost:3000" },
  },
});
