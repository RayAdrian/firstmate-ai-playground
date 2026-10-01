import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeContent } from "@/components/home/home-content";
import { HomeSkeleton } from "@/components/home/home-skeleton";
import { TITLE_SUFFIX } from "@/components/lesson/inline-text";

// Content and the digest come from the database, so the home page renders on every request (S-3).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Home · ${TITLE_SUFFIX}` };

export default function HomePage() {
  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">
        Learn Claude Code and Codex CLI, basics to orchestration
      </h1>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </>
  );
}
