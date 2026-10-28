import { vi } from "vitest";

/** A recording stand-in for the Supabase query builder: captures what each action asks the database to do. */

export type Op = {
  table: string;
  kind: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: [string, unknown][];
};

type Result = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};
type Handler = (op: Op) => Result | undefined;

export function makeDb(handler: Handler = () => undefined) {
  const ops: Op[] = [];

  const resolve = (op: Op): Result => {
    const custom = handler(op);
    if (custom) return { data: null, error: null, ...custom };
    return { data: op.kind === "update" ? [{ id: "row" }] : null, error: null };
  };

  const from = (table: string) => {
    const op: Op = { table, kind: "select", filters: [] };
    ops.push(op);
    const chain = {
      select: () => chain,
      update: (payload: unknown) => {
        op.kind = "update";
        op.payload = payload;
        return chain;
      },
      insert: (payload: unknown) => {
        op.kind = "insert";
        op.payload = payload;
        return chain;
      },
      delete: () => {
        op.kind = "delete";
        return chain;
      },
      eq: (column: string, value: unknown) => {
        op.filters.push([column, value]);
        return chain;
      },
      in: (column: string, value: unknown) => {
        op.filters.push([column, value]);
        return chain;
      },
      order: () => chain,
      maybeSingle: async () => resolve(op),
      then: (
        onFulfilled: (r: Result) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => Promise.resolve(resolve(op)).then(onFulfilled, onRejected),
    };
    return chain;
  };

  const storage = {
    upload: vi.fn<
      (
        path: string,
        file: File,
        options?: unknown,
      ) => Promise<{ error: { message: string } | null }>
    >(async () => ({ error: null })),
    remove: vi.fn<(paths: string[]) => Promise<{ error: null }>>(async () => ({
      error: null,
    })),
  };

  return {
    client: { from, storage: { from: vi.fn(() => storage) } },
    ops,
    storage,
    writes: () => ops.filter((o) => o.kind !== "select"),
  };
}
