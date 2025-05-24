import { createIdGenerator } from "../id-generator";

describe("ID Generator", () => {
  it("can generate a deterministic ID", () => {
    const idGenerator = createIdGenerator(8);
    expect(idGenerator(1746844013337).toString("ascii")).toBe("-OPs04BO");
  });

  it("generate random IDs across milliseconds", () => {
    const idGenerator = createIdGenerator(10);
    const idCount = 10000;

    const idSet = new Set<string>();
    for (let i = 0; i < idCount; i++) {
      const id = idGenerator(Date.now() + i).toString("ascii");
      idSet.add(id);
    }
    expect(idSet.size).toBe(idCount);
  });

  it("maintains an invariant that all generated IDs are unique and increasing", () => {
    const idGenerator = createIdGenerator(10);
    const idCount = 10000;

    const ids: string[] = [];
    for (let i = 0; i < idCount; i++) {
      ids.push(idGenerator().toString("ascii"));
    }

    expect(ids).toEqual(ids.sort());
    expect(ids.length).toBe(idCount);
    expect(new Set(ids).size).toBe(idCount);
  });
});
