import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";

const gitHash = (() => {
  try { return execSync("git rev-parse --short HEAD").toString().trim(); }
  catch { return "dev"; }
})();

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  define: {
    "import.meta.env.VITE_GIT_HASH": JSON.stringify(gitHash),
  },
});
