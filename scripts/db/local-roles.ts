// `npm run db:local-roles`: give the LOCAL community_writer role its login (PRD 18.4). Idempotent.
// The migration creates the role NOLOGIN with no stored secret, because `supabase db push` copies migrations to the hosted
// database. The local login is set here and in supabase/seed.sql (which runs on `supabase db reset`, never on `db push`).
// Refuses a non-local SUPABASE_URL or database URL (DP-6's guard). Hosted: the maintainer runs `alter role` once in the
// dashboard SQL editor with a generated secret and stores the connection string only as the Vercel env var
// COMMUNITY_DATABASE_URL. Never use `supabase db push --include-seed`.
import { Client } from "pg";
import { assertLocalSupabase } from "../seed/lib/local-guard";
import type { Env } from "../lib/env-profile";

/** A value that only ever works against the local stack (it is also in supabase/seed.sql and .env.example). */
const LOCAL_ONLY_SECRET = "community_writer_local_only";

/** The local `COMMUNITY_DATABASE_URL` (direct Postgres on the local stack, port 54422). */
export const LOCAL_COMMUNITY_DATABASE_URL = `postgresql://community_writer:${LOCAL_ONLY_SECRET}@127.0.0.1:54422/postgres`;

/** Default superuser connection of the local stack (supabase/config.toml `[db] port`). */
const LOCAL_DB_URL_DEFAULT = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

export function localRolesSql(): string {
  return `alter role community_writer with login password '${LOCAL_ONLY_SECRET}';`;
}

type Connect = (connectionString: string) => Promise<{ query(sql: string): Promise<unknown>; end(): Promise<void> }>;

const defaultConnect: Connect = async (connectionString) => {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
};

function assertLocalDatabaseUrl(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("db:local-roles: LOCAL_DB_URL is not a valid URL; it only runs against a local (127.0.0.1 or localhost) database.");
  }
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]") {
    throw new Error("db:local-roles only runs against a local (127.0.0.1 or localhost) database; refusing to touch a hosted one.");
  }
}

export async function applyLocalRoles(env: Env = process.env, connect: Connect = defaultConnect): Promise<void> {
  assertLocalSupabase(env.SUPABASE_URL);
  const dbUrl = env.LOCAL_DB_URL ?? LOCAL_DB_URL_DEFAULT;
  assertLocalDatabaseUrl(dbUrl);
  const client = await connect(dbUrl);
  try {
    await client.query(localRolesSql());
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("local-roles.ts")) {
  applyLocalRoles().then(
    () => console.log("db:local-roles: community_writer can log in on the local database."),
    (err: unknown) => {
      console.error(`db:local-roles: ${err instanceof Error ? err.message : "unexpected error"}`);
      process.exit(1);
    },
  );
}
