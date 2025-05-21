import { createIdGenerator } from "../shared";

describe("ID Generator", () => {
  it("can generate a deterministic ID", () => {
    const idGenerator = createIdGenerator(8);
    expect(idGenerator(1746844013337).toString("ascii")).toBe("-OPs04BO");
  });

  it("maintains an invariant that all generated IDs are unique and increasing", () => {
    const idGenerator = createIdGenerator(10);
    const ids: string[] = [];
    for (let i = 0; i < 1000; i++) {
      ids.push(idGenerator().toString("ascii"));
    }
    expect(ids).toEqual(ids.sort());
  });
});
