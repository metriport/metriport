import { MetriportError, NotFoundError } from "@metriport/shared";
import { isNotFoundError, S3Utils, splitS3Location } from "../s3";

beforeAll(() => {
  jest.restoreAllMocks();
});

describe("S3Utils", () => {
  // integration test
  describe.skip("getFileInfoFromS3", () => {
    const s3Utils = new S3Utils("us-west-2");
    it("returns empty string when gets empty string", async () => {
      const res = await s3Utils.getFileInfoFromS3("non-existing-key", "nonexisting-bucket");
      expect(res).toEqual({ exists: false });
    });

    it("works when exists", async () => {
      const res = await s3Utils.getFileInfoFromS3("...", "...");
      expect(res).toEqual(expect.objectContaining({ exists: true }));
    });
  });

  describe("splitS3Location", () => {
    it("returns undefined if it gets a location without server url", async () => {
      const key = "123/456/789.txt";
      const location = key;
      const res = splitS3Location(location);
      expect(res).toBeFalsy();
    });

    it("returns undefined if it gets a location without key", async () => {
      const bucketName = "bucket-name";
      const location = `https://${bucketName}.s3.us-east-2.amazonaws.com`;
      const res = splitS3Location(location);
      expect(res).toBeFalsy();
    });

    it("returns bucketName and key when it gets a valid S3 location with single key", async () => {
      const bucketName = "bucket-name";
      const key = "123";
      const location = `https://${bucketName}.s3.us-east-2.amazonaws.com/${key}`;
      const res = splitS3Location(location);
      console.log(`res: ${JSON.stringify(res, null, 2)}`);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.objectContaining({ bucketName, key }));
    });

    it("returns bucketName and key when it gets a valid S3 location with longer key", async () => {
      const bucketName = "bucket-name";
      const key = "123/456/789.txt";
      const location = `https://${bucketName}.s3.us-east-2.amazonaws.com/${key}`;
      const res = splitS3Location(location);
      console.log(`res: ${JSON.stringify(res, null, 2)}`);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.objectContaining({ bucketName, key }));
    });
  });

  describe("isNotFoundError", () => {
    it("returns false when no code or statusCode", async () => {
      const error = {};
      const res = isNotFoundError(error);
      expect(res).toEqual(false);
    });

    it("returns true when code is NoSuchKey", async () => {
      const error = { code: "NoSuchKey" };
      const res = isNotFoundError(error);
      expect(res).toEqual(true);
    });

    it("returns true when Code is NoSuchKey", async () => {
      const error = { Code: "NoSuchKey" };
      const res = isNotFoundError(error);
      expect(res).toEqual(true);
    });

    it("returns true when statusCode is 404", async () => {
      const error = { statusCode: 404 };
      const res = isNotFoundError(error);
      expect(res).toEqual(true);
    });

    it("returns true when it gets NotFoundError", async () => {
      const error = new NotFoundError("Key not found");
      const res = isNotFoundError(error);
      expect(res).toEqual(true);
    });

    it("returns false when it gets MetriportError", async () => {
      const error = new MetriportError("Key not found");
      const res = isNotFoundError(error);
      expect(res).toEqual(false);
    });
  });
});
