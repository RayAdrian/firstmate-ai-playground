import { notFound } from "next/navigation";
import { workflowExists } from "@/lib/workflows/queries";

// The existence check lives in the layout, above the loading.tsx Suspense boundary, so an unknown or removed
// slug gets a real HTTP 404 (a notFound() inside a streamed page would be a 200). The heavy read is in the page.
export default async function WorkflowLayout({ children, params }: LayoutProps<"/workflows/[slug]">) {
  const { slug } = await params;
  if (!(await workflowExists(slug))) notFound();
  return children;
}
