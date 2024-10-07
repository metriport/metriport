import { splitDob } from "../patient";

describe("normalization", () => {
  it("dob split", async () => {
    const dobValid = "2023-08-01";
    const result = splitDob(dobValid);
    expect(result).toMatchObject(["2023", "08", "01"]);
  });
});
