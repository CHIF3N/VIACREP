import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
    "/*": ["public/letterhead/**/*"],
  },
};

export default nextConfig;
