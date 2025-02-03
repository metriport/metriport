import { isUsefulDisplay } from "../../codeable-concept";

describe("isUselessDisplay", () => {
  it("correctly recognizes unknown as a useless display", () => {
    const result = isUsefulDisplay("Unknown");
    expect(result).toEqual(false);
  });

  it("correctly recognizes unknown as a useless display", () => {
    const result = isUsefulDisplay("No data available for this section");
    expect(result).toEqual(false);
  });

  it("correctly recognizes a useful description as something useful", () => {
    const result = isUsefulDisplay("Some useful description");
    expect(result).toEqual(true);
  });

  it("correctly recognizes a useful description as something useful", () => {
    const result = isUsefulDisplay("");
    expect(result).toEqual(false);
  });
});
