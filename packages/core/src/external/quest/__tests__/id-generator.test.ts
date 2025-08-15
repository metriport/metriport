import { buildQuestExternalId } from "../id-generator";

describe("Quest ID generator", () => {
  it("should generate a 15 character ID", () => {
    const id = buildQuestExternalId();
    expect(id.length).toBe(15);
  });

  it("should match an expected regex", () => {
    const rounds = 1000;
    for (let i = 0; i < rounds; i++) {
      const id = buildQuestExternalId();
      expect(id).toMatch(/^[A-Z0-9]{15}$/);
    }
  });
});
