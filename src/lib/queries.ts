import { queryOptions } from "@tanstack/react-query";
import { fetchContracts } from "./sheets.functions";

export const contractsQueryOptions = () =>
  queryOptions({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(),
    staleTime: 0,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });