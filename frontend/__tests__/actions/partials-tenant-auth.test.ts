import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserContextMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })));
const andMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })));
const orMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ op: "or", conditions })));
const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

function createSelectChain(result: unknown[] = []) {
  const chain: Record<string, any> = {};
  for (const method of ["from", "where", "limit", "orderBy", "offset"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
  return chain;
}

function createInsertChain(result: unknown[], onValues?: (value: Record<string, unknown>) => void) {
  const chain: Record<string, any> = {};
  chain.values = vi.fn((value: Record<string, unknown>) => {
    onValues?.(value);
    return chain;
  });
  chain.returning = vi.fn(async () => result);
  return chain;
}

function createUpdateChain(result: unknown[], onSet?: (value: Record<string, unknown>) => void) {
  const chain: Record<string, any> = {};
  chain.set = vi.fn((value: Record<string, unknown>) => {
    onSet?.(value);
    return chain;
  });
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn(async () => result);
  return chain;
}

vi.mock("@/lib/auth-utils", () => ({
  getUserContext: getUserContextMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "partial-1"),
}));
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: eqMock,
    and: andMock,
    or: orMock,
    desc: vi.fn((column: unknown) => ({ op: "desc", column })),
    asc: vi.fn((column: unknown) => ({ op: "asc", column })),
    ilike: vi.fn((column: unknown, value: unknown) => ({ op: "ilike", column, value })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings, values })),
  };
});
vi.mock("@/lib/db", () => ({
  db: dbMock,
  templatePartials: {
    id: "template_partials.id",
    name: "template_partials.name",
    description: "template_partials.description",
    content: "template_partials.content",
    placeholders: "template_partials.placeholders",
    usage: "template_partials.usage",
    createdBy: "template_partials.created_by",
    organizationId: "template_partials.organization_id",
    createdAt: "template_partials.created_at",
    updatedAt: "template_partials.updated_at",
  },
}));

import {
  createPartial,
  getPartial,
  listPartials,
  searchPartials,
  trackPartialUsage,
  updatePartial,
} from "@/lib/actions/partials";

beforeEach(() => {
  vi.clearAllMocks();
  getUserContextMock.mockResolvedValue({
    userId: "partial-user-1",
    organizationId: "org-1",
  });
  dbMock.select.mockReturnValue(createSelectChain([]));
});

describe("partial tenant scoping", () => {
  it("requires organization context before creating partials", async () => {
    getUserContextMock.mockResolvedValueOnce({
      userId: "partial-user-1",
      organizationId: undefined,
    });

    await expect(createPartial({
      name: "Management approach",
      content: { type: "doc", content: [] },
    })).rejects.toThrow("No organization context");

    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("creates partials under the session organization", async () => {
    const inserted: Record<string, unknown>[] = [];
    dbMock.insert.mockReturnValueOnce(createInsertChain([partialRow()], (value) => inserted.push(value)));

    const partial = await createPartial({
      name: "Management approach",
      content: { type: "doc", content: [] },
    });

    expect(partial.id).toBe("partial-1");
    expect(inserted[0]).toMatchObject({
      createdBy: "partial-user-1",
      organizationId: "org-1",
    });
  });

  it("builds tenant-visible predicates when loading a partial by id", async () => {
    dbMock.select.mockReturnValueOnce(createSelectChain([]));

    await getPartial("partial-1");

    expect(eqMock).toHaveBeenCalledWith("template_partials.id", "partial-1");
    expect(eqMock).toHaveBeenCalledWith("template_partials.created_by", "partial-user-1");
    expect(eqMock).toHaveBeenCalledWith("template_partials.organization_id", "org-1");
  });

  it("uses creator and organization predicates for partial updates", async () => {
    dbMock.select.mockReturnValueOnce(createSelectChain([partialRow()]));
    dbMock.update.mockReturnValueOnce(createUpdateChain([partialRow({ name: "Updated" })]));

    const partial = await updatePartial("partial-1", { name: "Updated" });

    expect(partial?.name).toBe("Updated");
    expect(eqMock).toHaveBeenCalledWith("template_partials.id", "partial-1");
    expect(eqMock).toHaveBeenCalledWith("template_partials.created_by", "partial-user-1");
    expect(eqMock).toHaveBeenCalledWith("template_partials.organization_id", "org-1");
  });

  it("scopes usage tracking reads and writes by tenant visibility", async () => {
    const updated: Record<string, unknown>[] = [];
    dbMock.select.mockReturnValueOnce(createSelectChain([partialRow()]));
    dbMock.update.mockReturnValueOnce(createUpdateChain([], (value) => updated.push(value)));

    await trackPartialUsage("partial-1", "template-1");

    expect(updated[0]).toMatchObject({
      usage: {
        templateIds: ["template-1"],
        useCount: 1,
      },
    });
    expect(eqMock).toHaveBeenCalledWith("template_partials.id", "partial-1");
    expect(eqMock).toHaveBeenCalledWith("template_partials.organization_id", "org-1");
  });

  it("normalizes partial list pagination", async () => {
    const rowsChain = createSelectChain([]);
    dbMock.select
      .mockReturnValueOnce(rowsChain)
      .mockReturnValueOnce(createSelectChain([{ count: 0 }]));

    await expect(listPartials({ limit: -20, offset: -5 })).resolves.toEqual({
      partials: [],
      total: 0,
    });

    expect(rowsChain.limit).toHaveBeenCalledWith(1);
    expect(rowsChain.offset).toHaveBeenCalledWith(0);
  });

  it("normalizes partial search limits", async () => {
    const rowsChain = createSelectChain([]);
    dbMock.select.mockReturnValueOnce(rowsChain);

    await expect(searchPartials("management", Number.POSITIVE_INFINITY)).resolves.toEqual([]);

    expect(rowsChain.limit).toHaveBeenCalledWith(20);
  });
});

function partialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "partial-1",
    name: "Management approach",
    description: null,
    content: { type: "doc", content: [] },
    placeholders: [],
    usage: { templateIds: [], useCount: 0 },
    createdBy: "partial-user-1",
    organizationId: "org-1",
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    ...overrides,
  };
}
