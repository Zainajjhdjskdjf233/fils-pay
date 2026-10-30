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
    // E86: never forward /v1/admin from the merchant dashboard (the hosted
    // nginx answers 404 there too); the admin console has its own dev server.
    proxy: { "^/v1/(?!admin(/|$))": "http://localhost:3000", "/healthz": "http://localhost:3000", "/readyz": "http://localhost:3000" },
  },
});
