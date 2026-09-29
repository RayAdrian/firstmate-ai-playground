import { dbRead } from "@/lib/db";
import { getReadClient } from "@/lib/db/server";

// Content routes render dynamically so seeded changes show without a rebuild (S-3).
export const dynamic = "force-dynamic";

// M0 stub: a real DB read so the "database unreachable" state (PRD §9) is exercised.
export default async function CurriculumPage() {
  const levels = await dbRead(
    getReadClient().from("levels").select("slug").is("archived_at", null),
  );
  return (
    <>
      <h1>Curriculum</h1>
      {levels.length === 0 && <p>No lessons seeded yet. Run `npm run seed`.</p>}
    </>
  );
}
