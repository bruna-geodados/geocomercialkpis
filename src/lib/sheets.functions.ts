import { createServerFn } from "@tanstack/react-start";

export const fetchContracts = createServerFn({ method: "GET" }).handler(
  async () => {
    const { loadContracts } = await import("./sheets.server");
    return loadContracts();
  },
);