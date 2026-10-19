import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: process.env.SITE_URL || "http://localhost:4321",
  base: process.env.BASE_PATH || "/",
  output: "static",
  trailingSlash: "always",
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    server: {
      proxy: {
        "/api": { target: "http://127.0.0.1:8788", changeOrigin: true },
      },
    },
    build: { cssCodeSplit: true },
  },
});
