"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { questionAPI, type QuestionDetail } from "@/lib/api";
import Container from "@/components/layout/Container";
import QuestionPreview from "@/components/preview/QuestionPreview";
import Button from "@/components/ui/Button";
import { ArrowLeft, Pencil, Eye, EyeOff, Shuffle } from "lucide-react";

export default function QuestionPreviewPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [seedKey, setSeedKey] = useState(() => Date.now().toString());

  useEffect(() => {
    if (isNaN(id)) {
      setError("ID soal tidak valid");
      setLoading(false);
      return;
    }
    questionAPI
      .getById(id)
      .then((res) => setQuestion(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error || "Gagal memuat soal");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  if (error || !question) {
    return (
      <Container>
        <div className="py-12 text-center">
          <p className="text-sm text-danger">{error || "Soal tidak ditemukan"}</p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Link
        href="/admin/questions"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar soal
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            Preview Soal #{question.id}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Tampilan ini sama persis dengan yang akan dilihat siswa saat mengerjakan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSeedKey(Date.now().toString())}
            title="Acak ulang urutan opsi"
          >
            <Shuffle className="w-3.5 h-3.5 mr-1.5" />
            Acak ulang
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnswerKey((v) => !v)}
          >
            {showAnswerKey ? (
              <>
                <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                Sembunyikan kunci
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Tampilkan kunci
              </>
            )}
          </Button>
          <Link href={`/admin/questions/${id}`}>
            <Button size="sm">
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Edit Soal
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl">
        <QuestionPreview
          key={seedKey}
          question={question}
          seed={seedKey}
          showAnswerKey={showAnswerKey}
        />
      </div>
    </Container>
  );
}
