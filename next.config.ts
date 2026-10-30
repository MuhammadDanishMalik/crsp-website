import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // the migration files are read from disk at start-up: make sure serverless bundles carry them
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  serverExternalPackages: ["@electric-sql/pglite", "pdfkit", "exceljs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
