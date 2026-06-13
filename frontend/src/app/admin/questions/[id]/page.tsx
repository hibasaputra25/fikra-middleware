"use client";

import { useParams } from "next/navigation";
import QuestionForm from "@/components/admin/QuestionForm";

export default function EditQuestionPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);

  if (isNaN(id)) {
    return <div className="p-8 text-center text-sm text-text-muted">ID soal tidak valid</div>;
  }

  return <QuestionForm questionId={id} />;
}
