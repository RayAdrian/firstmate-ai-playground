import { CommandLine } from "@/components/ui/command-line";

/** Empty curriculum / exercises (S9-02): what is missing, and the command that fixes it. */
export function SeedEmptyState() {
  return (
    <section
      aria-labelledby="empty-title"
      className="max-w-xl rounded-card border border-dashed border-border bg-canvas p-6 md:p-8"
    >
      <h2 id="empty-title" className="text-lg font-bold text-fg-strong">
        No lessons seeded yet. Run <code className="font-mono">npm run seed</code>.
      </h2>
      <p className="mt-2 text-base text-fg-muted">
        The curriculum is read from the local database, which is empty right now.
      </p>
      <CommandLine label="Terminal" command="npm run seed" />
    </section>
  );
}
