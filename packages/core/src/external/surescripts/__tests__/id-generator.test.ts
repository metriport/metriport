import { createIdGenerator } from "../id-generator";

describe("ID Generator", () => {
  // Precomputed values for an ID
  const exampleTimestamp = 1746844013337;
  const exampleTimestampIdPrefix = "-OPs04BO";

  it("should generate an ID of the correct length", () => {
    const idGenerator = createIdGenerator(10);
    expect(idGenerator().toString("ascii").length).toBe(10);
  });

  it("should generate an ID with the correct format", () => {
    const idGenerator = createIdGenerator(10);
    expect(idGenerator().toString("ascii")).toMatch(/^[a-zA-Z0-9_-]{10}$/);
  });

  it("should be able to generate an ID with arbitrary entropy", () => {
    const idGenerator = createIdGenerator(20);
    expect(idGenerator().toString("ascii")).toMatch(/^[a-zA-Z0-9_-]{20}$/);
  });

  it("can generate a deterministic ID", () => {
    const idGenerator = createIdGenerator(8);
    expect(idGenerator(exampleTimestamp).toString("ascii")).toBe(exampleTimestampIdPrefix);
  });

  it("can generate a deterministic ID with entropy", () => {
    const idGenerator = createIdGenerator(10);
    const generatedId = idGenerator(exampleTimestamp).toString("ascii");
    expect(generatedId.substring(0, 8)).toBe(exampleTimestampIdPrefix);
    expect(generatedId.substring(8)).toMatch(/^[a-zA-Z0-9_-]{2}$/);
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

  it("should generate a random ID within the same millisecond", () => {
    const currentTimestamp = 1746844013337;
    const idGenerator = createIdGenerator(10, {
      lastTime: currentTimestamp,
      lastEntropy: Buffer.from("aa", "ascii"),
    });
    const currentTimestampId = idGenerator(currentTimestamp).toString("ascii");

    const anotherIdGenerator = createIdGenerator(10, {
      lastTime: currentTimestamp,
      lastEntropy: Buffer.from(currentTimestampId.substring(8), "ascii"),
    });
    const anotherId = anotherIdGenerator(currentTimestamp).toString("ascii");
    expect(anotherId.substring(0, 8)).toEqual(currentTimestampId.substring(0, 8));
    expect(anotherId.substring(8)).not.toEqual(currentTimestampId.substring(8));
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
  });

  it("should overflow the entropy buffer", () => {
    const currentTimestamp = 1746844013337;
    const idGenerator = createIdGenerator(10, {
      lastTime: currentTimestamp,
      lastEntropy: Buffer.from("zz", "ascii"),
    });
    expect(idGenerator(currentTimestamp).toString("ascii")).toBe("-OPs04BO--");
  });
});
