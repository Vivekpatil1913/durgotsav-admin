import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { EDITION_YEAR } from "./src/config/edition.js";

// index.html is static: fill %EDITION_YEAR% in its title
const editionYear = () => ({
  name: "edition-year",
  transformIndexHtml: { order: "pre", handler: (html) => html.replaceAll("%EDITION_YEAR%", String(EDITION_YEAR)) },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const api = env.VITE_DEV_API_PROXY || "http://localhost:4100";
  return {
    plugins: [react(), editionYear()],
    server: { port: 5174, proxy: { "/api": api, "/uploads": api } },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const pkg = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(id.replace(/\\/g, "/"))?.[1];
            if (!pkg) return undefined;
            if (["react", "react-dom", "scheduler", "react-router", "react-router-dom"].includes(pkg)) return "react";
            return "vendor";
          },
        },
      },
    },
  };
});
