import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz en frontend/: hay otros package-lock.json en carpetas superiores
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
