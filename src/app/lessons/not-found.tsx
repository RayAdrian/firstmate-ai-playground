import { NotFoundView } from "@/components/ui";

// Shown for unknown and archived slugs (S9-05). The slug is never echoed back.
export default function LessonNotFound() {
  return (
    <NotFoundView heading="Lesson not found">
      This lesson doesn&apos;t exist or has been retired. Pick another from the curriculum.
    </NotFoundView>
  );
}
