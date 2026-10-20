import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/repas/",
  plugins: [react()],
  test: { include: ["tests/**/*.test.ts"], environment: "node", maxWorkers: 1 },
});
