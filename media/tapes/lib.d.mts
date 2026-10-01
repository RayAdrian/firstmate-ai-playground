export type Cue = { start: number; end: number; text: string };
export function vttTime(seconds: number): string;
export function validateCues(cues: unknown, durationS?: number): string[];
export function buildVtt(cues: Cue[]): string;
export function scanForLeaks(
  text: string,
  opts?: { user?: string; home?: string; secrets?: string[] },
): string[];
export function sha256Bytes(buf: Uint8Array): string;
export function sha256File(path: string): string;
export function parseVersion(output: string): string | null;
