/** The text that gets copied and shown: the fence's source with only its final trailing newline trimmed. */
export function codeSource(code: string): string {
  return code.replace(/\r?\n$/, "");
}

/** Label rule (DESIGN.md §4.5): the filename if given, else the language, else "text". */
export function codeLabel({ title, language }: { title?: string; language?: string }): string {
  return title?.trim() || language?.trim() || "text";
}
