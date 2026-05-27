import { useQuery, useQueryClient, useIsFetching } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { contractsQueryOptions } from "@/lib/queries";
import { Button } from "@/components/ui/button";

export function LiveRefreshIndicator() {
  const qc = useQueryClient();
  const { data } = useQuery(contractsQueryOptions());
  const fetching = useIsFetching({ queryKey: ["contracts"] }) > 0;

  const ts = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="hidden sm:inline-flex items-center gap-1.5 text-muted-foreground">
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (fetching
              ? "bg-[oklch(0.72_0.16_70)] animate-pulse"
              : "bg-[oklch(0.55_0.14_155)]")
          }
        />
        {fetching ? "Sincronizando..." : `Atualizado às ${ts}`}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7"
        disabled={fetching}
        onClick={() => qc.invalidateQueries({ queryKey: ["contracts"] })}
      >
        <RefreshCw className={"h-3.5 w-3.5 " + (fetching ? "animate-spin" : "")} />
        <span className="ml-1.5 hidden md:inline">Atualizar</span>
      </Button>
    </div>
  );
}