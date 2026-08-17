import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Erorile de tip și de lint blochează build-ul: CI le prinde oricum, dar
  // vrem să eșueze și local, nu doar în pipeline.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
