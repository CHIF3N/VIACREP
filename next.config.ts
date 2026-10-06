import path from "node:path";
import type { NextConfig } from "next";

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER);

const nextConfig: NextConfig = {
  // Standalone output is for container/Docker environments (e.g. AI Studio).
  // On Vercel, Vercel natively handles serverless bundling.
  // Setting output: "standalone" on Vercel causes Next.js 16 Turbopack with adapters
  // to suppress emitting .next/next-server.js.nft.json, crashing Vercel's onBuildComplete.
  output: isVercel ? undefined : "standalone",
  allowedDevOrigins: [
    "*.run.app",
    "ais-dev-b7ex5buxcuwtrjjqez4hye-584903286491.europe-west2.run.app",
    "ais-pre-b7ex5buxcuwtrjjqez4hye-584903286491.europe-west2.run.app",
  ],
  // The project sits under a home directory that contains an unrelated
  // package-lock.json; pin the workspace root so Turbopack ignores it.
  turbopack: { root: path.resolve(__dirname) },
  // xlsx and pdfjs-dist use dynamic require and Node.js APIs — exclude from bundler.
  serverExternalPackages: ["exceljs", "xlsx", "pdfjs-dist"],
  // The Word export reads the letterhead PNGs at request time through a path
  // built from process.cwd() (src/lib/exports/docx.ts), which the output file
  // tracer cannot follow. On a serverless host `public/` is served by the CDN
  // and is absent from the function's filesystem, so without this the .docx
  // export throws ENOENT in production while working fine locally.
  outputFileTracingIncludes: {
    "/**/*": ["public/letterhead/**/*"],
    "/api/**/*": ["public/letterhead/**/*"],
  },
};

export default nextConfig;
