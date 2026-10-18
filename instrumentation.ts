/** Wake the durable ingest worker whenever a Node.js server process starts.
 * The worker atomically reclaims jobs whose previous lease expired. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { kickIngestWorker } = await import("./lib/services/ingestService");
    kickIngestWorker();
  }
}
