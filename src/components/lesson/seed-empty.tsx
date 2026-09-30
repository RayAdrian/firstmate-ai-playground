import { EmptyState } from "@/components/ui";

/** Empty curriculum / exercises (S9-02): what is missing, and the command that fixes it. */
export function SeedEmptyState() {
  return (
    <EmptyState
      title={
        <>
          No lessons seeded yet. Run <code className="font-mono">npm run seed</code>.
        </>
      }
      command="npm run seed"
    >
      The curriculum is read from the local database, which is empty right now.
    </EmptyState>
  );
}
