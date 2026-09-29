// M0 STUB. WS-B replaces this with the idempotent, validating seed (PRD S-2).
// For now it only proves the service-role connection and the migration work.
import { getServiceClient } from "../../src/lib/db/service";

async function main() {
  const db = getServiceClient();
  const { data, error } = await db
    .from("news_sources")
    .select("slug");
  if (error) {
    console.error(`seed: cannot reach the local database: ${error.message}`);
    console.error("Run `supabase start` first.");
    process.exit(1);
  }
  console.log(`seed: stub OK (${data.length} news_sources present). Content seeding is owned by WS-B.`);
}

main();
