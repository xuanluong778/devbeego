import LessonPlayer from "@/components/beego/lesson-player/LessonPlayer";

export default function LessonPlayerPage({ params }) {
  return <LessonPlayer lessonId={params.lessonId} />;
}
