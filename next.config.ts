import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // the migration files are read from disk at start-up: make sure serverless bundles carry them
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  serverExternalPackages: ["@electric-sql/pglite", "pdfkit", "exceljs"],
  // Going back to a page seen in the last 20 s shows it at once (and refreshes it quietly): tab switching no longer waits for the server every time.
  experimental: { staleTimes: { dynamic: 20, static: 180 } },
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
