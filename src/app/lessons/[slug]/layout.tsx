import { notFound } from "next/navigation";
import { getLessonPage } from "@/components/lesson/server/queries";

// The existence check lives in the layout, above the loading.tsx Suspense boundary, so an unknown
// or archived slug gets a real HTTP 404 (a notFound() inside a streamed page would be a 200).
// The page reads the same request-cached result.
export default async function LessonLayout({ children, params }: LayoutProps<"/lessons/[slug]">) {
  const { slug } = await params;
  if (!(await getLessonPage(slug))) notFound();
  return children;
}
