import type { Metadata } from "next";
import { NotFoundView } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found · First Mate AI Playground" };

export default function NotFound() {
  return <NotFoundView />;
}
