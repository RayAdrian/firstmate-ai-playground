// @ts-check
import { warn } from "./log.js";

const DEFAULT_PORT = 3000;

/** @param {string | undefined} value @returns {number} */
export function parsePort(value) {
  const port = parseInt(value ?? "", 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    warn("bad port, using default", value);
    return DEFAULT_PORT;
  }
  return port;
}
