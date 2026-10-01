import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Workflow not found · First Mate AI Playground" };

// Unknown or removed slugs (PRD WF-33). The slug is never echoed back.
export default function WorkflowNotFound() {
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-bold uppercase tracking-eyebrow text-link">404</p>
      <h1 className="mt-2 text-3xl font-bold text-fg-strong md:text-4xl">Workflow not found</h1>
      <p className="mt-4 text-prose text-fg">
        This workflow doesn&apos;t exist or has been removed. Browse the others.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <ButtonLink href="/workflows" variant="primary">
          Go to workflows
        </ButtonLink>
        <Link href="/" className="text-base font-medium text-link underline underline-offset-2 hover:decoration-2">
          Home
        </Link>
      </div>
    </div>
  );
}
