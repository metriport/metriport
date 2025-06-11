import { lexicalId, getTimestampFromId } from "../lexical-id";

describe("ID Generator", () => {
  // Precomputed values for an ID
  const exampleTimestamp = 1746844013337;
  const exampleTimestampIdPrefix = "-OPs04BO";

  it("should generate an ID of the correct length", () => {
    const idGenerator = lexicalId(10);
    expect(idGenerator().toString("ascii").length).toBe(10);
  });

  it("should generate an ID with the correct format", () => {
    const idGenerator = lexicalId(10);
    expect(idGenerator().toString("ascii")).toMatch(/^[a-zA-Z0-9_-]{10}$/);
  });

  it("should be able to generate an ID with arbitrary entropy", () => {
    const idGenerator = lexicalId(20);
    expect(idGenerator().toString("ascii")).toMatch(/^[a-zA-Z0-9_-]{20}$/);
  });

  it("can generate a deterministic ID", () => {
    const idGenerator = lexicalId(8);
    expect(idGenerator(exampleTimestamp).toString("ascii")).toBe(exampleTimestampIdPrefix);
  });

  it("can extract the timestamp from a deterministic ID", () => {
    const idGenerator = lexicalId(8);
    const id = idGenerator(exampleTimestamp).toString("ascii");
    console.log(getTimestampFromId("-ORx36JfiG"));
    expect(getTimestampFromId(id)).toBe(exampleTimestamp);
  });

  it("can generate a deterministic ID with entropy", () => {
    const idGenerator = lexicalId(10);
    const generatedId = idGenerator(exampleTimestamp).toString("ascii");
    expect(generatedId.substring(0, 8)).toBe(exampleTimestampIdPrefix);
    expect(generatedId.substring(8)).toMatch(/^[a-zA-Z0-9_-]{2}$/);
  });

  it("can extract the timestamp from a deterministic ID with entropy", () => {
    const idGenerator = lexicalId(10);
    const id = idGenerator(exampleTimestamp).toString("ascii");
    expect(getTimestampFromId(id)).toBe(exampleTimestamp);
  });

  it("generate random IDs across milliseconds", () => {
    const idGenerator = lexicalId(10);
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
    const idGenerator = lexicalId(10, {
      lastGenerationTime: currentTimestamp,
      entropyOfLastGeneratedId: Buffer.from("aa", "ascii"),
    });
    const timestampId = idGenerator(currentTimestamp).toString("ascii");
    const timestampIdInSameMilli = idGenerator(currentTimestamp).toString("ascii");
    expect(timestampIdInSameMilli.substring(0, 8)).toEqual(timestampId.substring(0, 8));
    expect(timestampIdInSameMilli.substring(8)).not.toEqual(timestampId.substring(8));
  });

  it("maintains an invariant that all generated IDs are unique and increasing", () => {
    const idGenerator = lexicalId(10);
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
    const idGenerator = lexicalId(10, {
      lastGenerationTime: currentTimestamp,
      entropyOfLastGeneratedId: Buffer.from("zz", "ascii"),
    });
    expect(idGenerator(currentTimestamp).toString("ascii")).toBe("-OPs04BO--");
  });
});
