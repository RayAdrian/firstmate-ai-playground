import Link from "next/link";

// Shown for unknown and archived slugs (S9-05). The slug is never echoed back.
export default function LessonNotFound() {
  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong">Lesson not found</h1>
      <p className="mt-2 text-base text-fg-muted">This lesson doesn&apos;t exist or has been retired.</p>
      <Link
        href="/curriculum"
        className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-base font-bold text-primary-fg hover:bg-primary-hover"
      >
        Go to curriculum
      </Link>
    </>
  );
}
