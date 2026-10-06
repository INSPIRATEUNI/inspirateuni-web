import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz en frontend/: hay otros package-lock.json en carpetas superiores
  turbopack: {
    root: path.join(__dirname),
  },
  // Rutas antiguas, antes de agrupar los subprogramas bajo PROVOV
  async redirects() {
    return [
      { source: "/OpenDay", destination: "/provov/open-day", permanent: true },
      { source: "/Igirl", destination: "/inspirate-girl", permanent: true },
      {
        source: "/ovpgs",
        destination: "/provov/visitas-guiadas",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
