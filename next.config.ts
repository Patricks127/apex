import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O bucket "plan-documents" (migração 020) aceita PDFs até 20 MB;
      // o limite por omissão de Server Actions é 1 MB. Margem de 5 MB
      // para o overhead do multipart (fronteiras, cabeçalhos de campo).
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
