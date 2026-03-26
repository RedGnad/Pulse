import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // ethers v6 is ESM-only — don't bundle it, use node_modules directly
  serverExternalPackages: ["ethers"],
};

export default nextConfig;
