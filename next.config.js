/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep server-only PDF/AI packages out of the client bundle; they are used
  // exclusively in server-side route handlers. `unpdf` (parse-pdf route),
  // `pdf-parse`/`pdfjs-dist` (upload-pdf route), and the LangChain/LangGraph
  // stack (copilotkit + agent routes) all rely on Node built-ins.
  serverExternalPackages: [
    "unpdf",
    "pdf-parse",
    "pdfjs-dist",
    "@langchain/langgraph",
    "@langchain/core",
    "@langchain/google-genai",
    "@langchain/google-gauth",
    "@langchain/groq",
    "@neondatabase/serverless",
    "drizzle-orm",
  ],
};

module.exports = nextConfig;
