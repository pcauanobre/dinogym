import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      devOptions: {
        enabled: true,
        type: "module",
      },
      includeAssets: ["pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "DinoGym",
        short_name: "DinoGym",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#050B1D",
        theme_color: "#050B1D",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
