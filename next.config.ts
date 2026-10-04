import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js counts PDF pages on the server (lib/import/pdfPages.ts); it loads its own worker
  // module at runtime, so it runs from node_modules instead of being bundled
  serverExternalPackages: ['pdfjs-dist'],
};

export default nextConfig;
