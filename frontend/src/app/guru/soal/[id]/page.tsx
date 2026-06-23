"use client";

import { useParams } from "next/navigation";
import QuestionForm from "@/components/admin/QuestionForm";

export default function GuruEditSoalPage() {
  const params = useParams();
  return <QuestionForm questionId={Number(params.id)} />;
}
