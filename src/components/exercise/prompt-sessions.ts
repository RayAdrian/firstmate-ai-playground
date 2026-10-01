export type PromptSession = { title: string; text: string };

/**
 * An exercise's starting prompt may hold prompts for different sessions, separated by a blank line and a line
 * that opens "Then, in a fresh session:". Each session gets its own block so one Copy button never carries
 * text meant for another session. A prompt without that marker is a single block.
 */
export function splitPromptSessions(prompt: string): PromptSession[] {
  const marker = /\n\s*\n(?=Then, in a fresh session:\s*)/;
  const parts = prompt.split(marker).map((p) => p.trim().replace(/^Then, in a fresh session:\s*/, ""));
  if (parts.length < 2) return [{ title: "Prompt", text: prompt }];
  return parts.map((text, i) => ({
    title: i === 0 ? `Prompt, session 1 of ${parts.length}` : `Prompt, session ${i + 1} of ${parts.length} (fresh session)`,
    text,
  }));
}
