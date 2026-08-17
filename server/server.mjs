/**
 * The token endpoint.
 *
 * This exists because the mobile app must never hold your Edpire API key. Anyone
 * can unzip an APK and read its strings, so a key shipped in the app is a public
 * key. Instead the app asks this server for a short-lived token that is scoped to
 * one learner and one assessment, and expires in two hours.
 *
 * In your real product this is not a separate service. It is one route inside the
 * backend you already have, next to the session it reads from.
 *
 *   node server.mjs
 */
import { createServer } from "node:http"
import { createEdpireTokenHandler, toNodeHandler } from "@edpire/sdk/client"

const PORT = Number(process.env.PORT ?? 8787)
const API_KEY = process.env.EDPIRE_API_KEY

if (!API_KEY) {
  console.error("EDPIRE_API_KEY is not set. Copy .env.example to .env and fill it in.")
  process.exit(1)
}

const tokenHandler = toNodeHandler(
  createEdpireTokenHandler({
    apiKey: API_KEY,
    baseUrl: process.env.EDPIRE_BASE_URL ?? "https://edpire.com",

    /**
     * ─────────────────────────────────────────────────────────────────────────
     * THIS IS THE ONE FUNCTION YOU MUST REPLACE.
     * ─────────────────────────────────────────────────────────────────────────
     *
     * It answers "which learner is this request for?" and its answer decides
     * whose results get recorded. This example hardcodes a demo learner so the
     * app runs with no auth set up.
     *
     * In production, read the learner from YOUR session:
     *
     *   resolveLearner: async (req) => {
     *     const session = await auth.getSession(req.headers)
     *     return session?.user.id ?? null      // null returns 401
     *   }
     *
     * Never read the learner ID from the request body. If you do, anyone can
     * submit results as anyone else by editing one JSON field.
     */
    resolveLearner: async () => "demo-learner-001",

    /**
     * Optional, and omitted here only because this example publishes exactly one
     * assessment. In a real app, check here that the learner is entitled to this
     * assessment. This endpoint is reachable on its own, so a check on the screen
     * that opens the player is UX. This one is the boundary.
     */
  }),
)

const server = createServer((req, res) => {
  // The app runs on a device or emulator, so it is always a different origin.
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  if (req.method === "OPTIONS") return res.writeHead(204).end()

  if (req.method === "GET" && req.url === "/health") {
    return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }))
  }

  if (req.method === "POST" && req.url === "/api/edpire/token") {
    return tokenHandler(req, res)
  }

  res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Not found" }))
})

server.listen(PORT, () => {
  console.log(`Token server on http://localhost:${PORT}`)
  console.log(`  POST /api/edpire/token   { "assessmentId": "..." } -> { "token": "..." }`)
  console.log(`  GET  /health`)
})
