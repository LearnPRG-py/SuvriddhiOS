import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  server: {
    watch: {
      // Sandbox programs are written by the local backend. Watching them makes
      // every autosave trigger a full Vite reload.
      ignored: ["**/backend/codes/**", "**/backend/build/**"],
    },
  },
});
