export type { Database, ReadOnlyDatabase } from "./types";
// Clients are imported from their own files (server.ts / service.ts) so the
// service-role client can never be pulled in through this barrel.
