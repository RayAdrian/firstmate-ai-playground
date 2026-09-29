export default async function LessonPage({ params }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  return <h1>Lesson: {slug}</h1>;
}
