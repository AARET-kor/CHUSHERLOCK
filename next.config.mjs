/** @type {import('next').NextConfig} */
const nextConfig = {
  // The E2E server runs `next dev` alongside a developer's own dev server;
  // a separate build dir keeps them from deleting each other's chunks.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth"],
};

export default nextConfig;
