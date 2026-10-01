import { notFound } from "next/navigation";
import { lessonExists } from "@/components/lesson/server/queries";

// The existence check lives in the layout, above the loading.tsx Suspense boundary, so an unknown
// or archived slug gets a real HTTP 404 (a notFound() inside a streamed page would be a 200).
// The check is a one-row query; the heavy lesson load happens in the page, under loading.tsx, so the skeleton shows.
export default async function LessonLayout({ children, params }: LayoutProps<"/lessons/[slug]">) {
  const { slug } = await params;
  if (!(await lessonExists(slug))) notFound();
  return children;
}
