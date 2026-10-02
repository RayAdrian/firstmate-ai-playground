// The final ffmpeg encode shared by render.ts and render-tldr.ts. Run by Node directly (type stripping).
import { spawnSync } from "node:child_process";

export const hasFfmpeg = () => spawnSync("ffmpeg", ["-version"]).status === 0;

/**
 * Final encode: limited-range yuv420p (Remotion's own output is full-range "yuvj420p", which some players render with
 * washed-out colours), faststart so playback can begin before the file arrives, and no audio track (MD-2).
 * The input must be a full-range (jpeg frame) render, as both render scripts produce.
 */
export function finalEncode(rawMp4: string, outMp4: string, crf: number, extra: string[] = []): void {
  if (!hasFfmpeg()) throw new Error("ffmpeg with libx264 is required for the final encode (brew install ffmpeg)");
  const enc = spawnSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", rawMp4, "-an",
    "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-profile:v", "high", "-level", "4.0",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    ...extra, "-movflags", "+faststart", outMp4,
  ]);
  if (enc.status !== 0) throw new Error(`ffmpeg encode failed: ${enc.stderr}`);
}
