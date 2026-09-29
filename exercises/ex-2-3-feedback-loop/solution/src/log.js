// @ts-check

/** @param {string} message @param {string} [detail] */
export function warn(message, detail) {
  process.stderr.write(`warn: ${message}${detail === undefined ? "" : ` (${detail})`}\n`);
}
