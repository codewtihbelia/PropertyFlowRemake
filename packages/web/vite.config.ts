import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@propertyflow/shared": path.resolve(__dirname, "../shared/src"),
      "@splitzy/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
