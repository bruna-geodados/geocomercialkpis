import { queryOptions } from "@tanstack/react-query";
import { fetchContracts } from "./sheets.functions";

export const contractsQueryOptions = () =>
  queryOptions({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(),
    staleTime: 5 * 60 * 1000,
  });