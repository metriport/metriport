import { isUselessDisplay } from "../../codeable-concept";

describe("isUselessDisplay", () => {
  it("correctly recognizes unknown as a useless display", () => {
    const result = isUselessDisplay("Unknown");
    expect(result).toEqual(true);
  });

  it("correctly recognizes unknown as a useless display", () => {
    const result = isUselessDisplay("No data available for this section");
    expect(result).toEqual(true);
  });

  it("correctly recognizes a useful description as something useful", () => {
    const result = isUselessDisplay("Some useful description");
    expect(result).toEqual(false);
  });

  it("correctly recognizes a useful description as something useful", () => {
    const result = isUselessDisplay("");
    expect(result).toEqual(true);
  });
});
