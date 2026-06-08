import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function Container({ children, className }: ContainerProps) {
  return (
    <main className={cn("max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8", className)}>
      {children}
    </main>
  );
}