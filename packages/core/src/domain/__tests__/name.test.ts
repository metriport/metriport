import { splitName } from "../patient";

describe("split", () => {
  it("name split", async () => {
    const nameValid = "Test,Name";
    const result = splitName(nameValid);
    expect(result).toMatchObject(["Test", "Name"]);
  });
});
