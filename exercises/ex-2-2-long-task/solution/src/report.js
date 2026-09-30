import { parseRows } from "./parse.js";
import { renderReport } from "./render.js";

export function generateReport(csv) {
  return renderReport(parseRows(csv));
}
