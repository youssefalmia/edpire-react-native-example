/**
 * The token endpoint, plus a small assessment listing for the example's picker.
 *
 * This exists because the app must never hold your Edpire API key. Anyone can
 * unzip an APK and read its strings, so a key shipped in the app is a public
 * key. Instead the app asks this server for a short-lived token, scoped to one
 * learner and one assessment, that expires in two hours.
 *
 * In your real product this is not a separate service. It is one or two routes
 * inside the backend you already have, next to the session they read from.
 *
 *   node --env-file=.env server.mjs
 */
import { createServer } from "node:http"
import { createEdpireTokenHandler, toNodeHandler, EdpireClient } from "@edpire/sdk/client"

const PORT = Number(process.env.PORT ?? 8787)
const API_KEY = process.env.EDPIRE_API_KEY
const BASE_URL = process.env.EDPIRE_BASE_URL ?? "https://edpire.com"

/** How many assessments the example's picker shows. Yours would paginate. */
const PICKER_LIMIT = 5

if (!API_KEY) {
  console.error("EDPIRE_API_KEY is not set. Copy .env.example to .env and fill it in.")
  process.exit(1)
}

const client = new EdpireClient({ apiKey: API_KEY, baseUrl: BASE_URL })

/**
 * The published assessments this org can offer.
 *
 * The API key is used here, on the server. The app receives only titles and
 * IDs, neither of which is secret, and shows them for the learner to pick.
 */
async function listPublished() {
  const { items } = await client.getAssessments({ status: "published", limit: PICKER_LIMIT })
  return (items ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    exerciseCount: a.exercise_count ?? null,
  }))
}

const tokenHandler = toNodeHandler(
  createEdpireTokenHandler({
  apiKey: API_KEY,
  baseUrl: BASE_URL,

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
   * Optional, and omitted here only because this example publishes everything
   * in the org. In a real app, check here that the learner is entitled to this
   * assessment. This endpoint is reachable on its own, so a check on the screen
   * that opens the player is UX. This one is the boundary.
   */
  }),
)

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  // The app runs on a device or emulator, so it is always a different origin.
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  if (req.method === "OPTIONS") return res.writeHead(204).end()

  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { ok: true })
  }

  if (req.method === "GET" && req.url === "/api/edpire/assessments") {
    try {
      return json(res, 200, { assessments: await listPublished() })
    } catch (err) {
      console.error("Could not list assessments:", err.message)
      return json(res, 502, { error: "Could not reach Edpire. Check EDPIRE_API_KEY." })
    }
  }

  if (req.method === "POST" && req.url === "/api/edpire/token") {
    return tokenHandler(req, res)
  }

  json(res, 404, { error: "Not found" })
})

server.listen(PORT, async () => {
  console.log(`\nToken server on http://localhost:${PORT}`)
  console.log(`  GET  /api/edpire/assessments   the picker list`)
  console.log(`  POST /api/edpire/token         { assessmentId } -> { token }\n`)

  // Print what the app will offer, so you can see straight away whether your
  // API key works and whether there is anything published to play.
  try {
    const assessments = await listPublished()
    if (assessments.length === 0) {
      console.log("No published assessments in this organisation yet.")
      console.log("Create one at https://edpire.com, then publish it, and restart this server.")
      console.log("Guide: https://docs.edpire.com/quickstart\n")
    } else {
      console.log(`Published assessments (showing up to ${PICKER_LIMIT}):`)
      for (const a of assessments) console.log(`  ${a.id}  ${a.title}`)
      console.log("\nThe app lists these for you. You do not need to copy an ID by hand.\n")
    }
  } catch (err) {
    console.error(`Could not reach Edpire at ${BASE_URL}: ${err.message}`)
    console.error("Check EDPIRE_API_KEY in .env.\n")
  }
})
