import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "canvas", "@napi-rs/canvas"],
};

export default nextConfig;
