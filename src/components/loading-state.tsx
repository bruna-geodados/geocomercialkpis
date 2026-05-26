import { Loader2 } from "lucide-react";

export function LoadingState({
  label = "Carregando dados da planilha...",
}: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      <span className="text-sm">{label}</span>
    </div>
  );
}