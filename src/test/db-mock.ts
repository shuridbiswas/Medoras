import { vi } from "vitest";

/** A recording stand-in for the Supabase query builder: captures what each action asks the database to do. */

export type Op = {
  table: string;
  kind: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: [string, unknown][];
  limit?: number;
};

type Result = {
  data?: unknown;
  count?: number | null;
  error?: { code?: string; message?: string } | null;
};
type Handler = (op: Op) => Result | undefined;

export function makeDb(handler: Handler = () => undefined) {
  const ops: Op[] = [];

  const resolve = (op: Op): Result => {
    const custom = handler(op);
    if (custom) return { data: null, error: null, ...custom };
    return { data: op.kind === "update" || op.kind === "delete" ? [{ id: "row" }] : null, error: null };
  };

  const from = (table: string) => {
    const op: Op = { table, kind: "select", filters: [] };
    ops.push(op);
    // .single() / .maybeSingle() stay chainable (overrideTypes) and awaitable, like the real builder.
    const single = () => {
      const result = {
        overrideTypes: () => result,
        then: (
          onFulfilled: (r: Result) => unknown,
          onRejected?: (e: unknown) => unknown,
        ) => Promise.resolve(resolve(op)).then(onFulfilled, onRejected),
      };
      return result;
    };
    const chain = {
      select: (_columns?: string, options?: unknown) => {
        if (options) op.filters.push(["select options", options]);
        return chain;
      },
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
      neq: (column: string, value: unknown) => {
        op.filters.push([`${column}!=`, value]);
        return chain;
      },
      not: (column: string, _op: string, value: unknown) => {
        op.filters.push([`${column} not`, value]);
        return chain;
      },
      gte: (column: string, value: unknown) => {
        op.filters.push([`${column}>=`, value]);
        return chain;
      },
      contains: (column: string, value: unknown) => {
        op.filters.push([`${column} contains`, value]);
        return chain;
      },
      filter: (column: string, operator: string, value: unknown) => {
        op.filters.push([`${column} ${operator}`, value]);
        return chain;
      },
      or: (expression: string) => {
        op.filters.push(["or", expression]);
        return chain;
      },
      range: (from: number, to: number) => {
        op.filters.push(["range", [from, to]]);
        return chain;
      },
      lt: (column: string, value: unknown) => {
        op.filters.push([`${column}<`, value]);
        return chain;
      },
      is: (column: string, value: unknown) => {
        op.filters.push([`${column} is`, value]);
        return chain;
      },
      ilike: (column: string, value: unknown) => {
        op.filters.push([`${column} ilike`, value]);
        return chain;
      },
      limit: (n: number) => {
        op.limit = n;
        return chain;
      },
      overrideTypes: () => chain,
      order: () => chain,
      single: () => single(),
      maybeSingle: () => single(),
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
