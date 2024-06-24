import { S3Utils } from "../s3";

beforeAll(() => {
  jest.restoreAllMocks();
});

// integration test
describe.skip("S3Utils", () => {
  const s3Utils = new S3Utils("us-west-2");
  describe("getFileInfoFromS3", () => {
    it("returns empty string when gets empty string", async () => {
      const res = await s3Utils.getFileInfoFromS3("non-existing-key", "nonexisting-bucket");
      expect(res).toEqual({ exists: false });
    });

    it("works when exists", async () => {
      const res = await s3Utils.getFileInfoFromS3("...", "...");
      expect(res).toEqual(expect.objectContaining({ exists: true }));
    });
  });
});
