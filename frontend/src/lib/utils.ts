export function formatDate(isoString: string | null): string {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(isoString: string | null): string {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getScoreColor(score: number): string {
  if (score >= 700) return "text-success";
  if (score >= 500) return "text-warning";
  return "text-danger";
}

export function getScoreBgColor(score: number): string {
  if (score >= 700) return "bg-success";
  if (score >= 500) return "bg-warning";
  return "bg-danger";
}

export function getStatusColor(status: string): { bg: string; text: string; dot: string } {
  switch (status) {
    case "open":
      return { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" };
    case "closed":
      return { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" };
    case "upcoming":
      return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
    default:
      return { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" };
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Aktif";
    case "closed":
      return "Selesai";
    case "upcoming":
      return "Akan Datang";
    default:
      return status;
  }
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}