import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Sem PostgreSQL configurado, o módulo de clínica (/) não arranca: abrir o
    // Clinical Production Dashboard, que usa SQLite local e não precisa de servidor.
    return process.env.DATABASE_URL
      ? []
      : [{ source: "/", destination: "/producao", permanent: false }];
  },
};

export default nextConfig;
