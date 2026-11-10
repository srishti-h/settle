import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Live extraction reads the invoice PDFs from disk; ship them with the serverless function.
  outputFileTracingIncludes: { "/api/settle": ["./public/invoices/**"] },
};

export default nextConfig;
