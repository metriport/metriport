import { splitDob } from "../patient";

describe("split", () => {
  it("dob split", async () => {
    const dobValid = "2023-08-01";
    const result = splitDob(dobValid);
    expect(result).toMatchObject(["2023", "08", "01"]);
  });
});
