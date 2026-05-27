import { queryOptions } from "@tanstack/react-query";
import { fetchContracts } from "./sheets.functions";

export const contractsQueryOptions = () =>
  queryOptions({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });