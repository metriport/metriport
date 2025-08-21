import { getFuzziness } from "../query";

describe("query", () => {
  describe("getFuzziness", () => {
    it("returns AUTO when query is undefined  ", async () => {
      const fuziness = getFuzziness(undefined);
      expect(fuziness).toBe("AUTO");
    });
    it("returns 0 when query is 3 chars or less", async () => {
      const fuziness = getFuzziness("CDA");
      expect(fuziness).toBe("0");
    });
    it("returns 1 when query is 4 chars or more", async () => {
      const fuziness = getFuzziness("CDAS");
      expect(fuziness).toBe("1");
    });
  });
});
