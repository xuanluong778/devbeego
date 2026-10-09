import LessonPlayer from "@/components/beego/lesson-player/LessonPlayer";

export default function LessonPlayerPage({ params, searchParams }) {
  const replay = String(searchParams?.replay || "") === "1";
  return <LessonPlayer lessonId={params.lessonId} replay={replay} />;
}
