export type { Database, ReadOnlyDatabase } from "./types";
export {
  DB_UNAVAILABLE_COMMAND,
  DB_UNAVAILABLE_DIGEST,
  DB_UNAVAILABLE_MESSAGE,
  DbUnavailableError,
  dbRead,
  isConnectionFailure,
  isDbUnavailable,
} from "./errors";
// Clients are imported from their own files (server.ts / service.ts) so the
// service-role client can never be pulled in through this barrel.
