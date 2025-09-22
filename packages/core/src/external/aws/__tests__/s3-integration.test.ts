import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { buildDayjs } from "@metriport/shared/common/date";
import { Writable } from "stream";
import { S3Utils } from "../s3";

// KEEP THIS DISABLED
// KEEP THIS DISABLED
// KEEP THIS DISABLED
// Integration tests for S3Utils - these tests interact with real AWS S3
// To run these tests, you need AWS credentials configured, a test bucket, and
// re-enable tests (remove .skip)
describe.skip("S3Utils Integration Tests", () => {
  const TEST_BUCKET = ""; // POPULATE THIS
  const TEST_REGION = "us-east-2";
  const s3Utils = new S3Utils(TEST_REGION);

  const s3Client = new S3Client({ region: TEST_REGION });

  async function checkFileExists(bucket: string, key: string): Promise<boolean> {
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async function getFileMetadata(bucket: string, key: string) {
    const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(headCommand);
    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      eTag: response.ETag,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  }

  async function getFileContent(
    bucket: string,
    key: string,
    encoding?: BufferEncoding
  ): Promise<string> {
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(getCommand);
    if (!response.Body) throw new Error("No body in response");
    return await response.Body.transformToString(encoding ?? "utf-8");
  }

  async function checkFilesExist(bucket: string, keys: string[]): Promise<boolean[]> {
    const results = await Promise.all(keys.map(key => checkFileExists(bucket, key)));
    return results;
  }

  // Test data
  const timestamp = buildDayjs().toISOString();
  const testContent = "Hello, S3 Integration Test!";
  const testPrefix = "integration-test";
  const testKey = `${testPrefix}/${timestamp}/test-file.txt`;
  const testKey2 = `${testPrefix}/${timestamp}/test-file-2.txt`;
  const testMetadata = { testkey: "testValue", environment: "integration" };

  beforeAll(async () => {
    try {
      await deleteFiles({ s3Client, bucket: TEST_BUCKET, prefix: testPrefix });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    try {
      await deleteFiles({ s3Client, bucket: TEST_BUCKET, prefix: testPrefix });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("uploadFile", () => {
    it("should upload a file with content and metadata", async () => {
      const fileBuffer = Buffer.from(testContent, "utf-8");

      const result = await s3Utils.uploadFile({
        bucket: TEST_BUCKET,
        key: testKey,
        file: fileBuffer,
        contentType: "text/plain",
        metadata: testMetadata,
      });
      expect(result).toMatchObject({
        bucket: TEST_BUCKET,
        key: testKey,
        location: expect.stringContaining(TEST_BUCKET),
        eTag: expect.any(String),
      });
      expect(result.location).toContain(testKey);

      const fileExists = await checkFileExists(TEST_BUCKET, testKey);
      expect(fileExists).toBe(true);

      const fileMetadata = await getFileMetadata(TEST_BUCKET, testKey);
      expect(fileMetadata.contentType).toBe("text/plain");
      expect(fileMetadata.contentLength).toBe(fileBuffer.length);
      expect(fileMetadata.metadata).toEqual(testMetadata);

      const fileContent = await getFileContent(TEST_BUCKET, testKey);
      expect(fileContent).toBe(testContent);
    });
  });

  describe("getFileContentsAsString", () => {
    it("should download file contents as string", async () => {
      const content = await s3Utils.getFileContentsAsString(TEST_BUCKET, testKey);
      expect(content).toBe(testContent);
    });

    it("should handle different encodings", async () => {
      const testContentLatin1 = "Café crème naïve façade";
      const testKeyLatin1 = `${testPrefix}/${timestamp}/test-file-latin1.txt`;
      const fileBufferLatin1 = Buffer.from(testContentLatin1, "latin1");

      await s3Client.send(
        new PutObjectCommand({
          Bucket: TEST_BUCKET,
          Key: testKeyLatin1,
          Body: fileBufferLatin1,
          ContentType: "text/plain",
          ContentEncoding: "latin1",
          Metadata: testMetadata,
        })
      );

      const contentLatin1 = await s3Utils.getFileContentsAsString(
        TEST_BUCKET,
        testKeyLatin1,
        "latin1"
      );
      expect(contentLatin1).toBe(testContentLatin1);

      // Download with utf-8 encoding and verify it does NOT match (should be different)
      const contentUtf8 = await getFileContent(TEST_BUCKET, testKeyLatin1, "utf-8");
      expect(contentUtf8).not.toBe(testContentLatin1);
    });
  });

  describe("getFileContentsAsBuffer", () => {
    it("should download file contents as buffer", async () => {
      const buffer = await s3Utils.getFileContentsAsBuffer({ bucket: TEST_BUCKET, key: testKey });
      expect(buffer.toString("utf-8")).toBe(testContent);
    });
  });

  describe("getFileContentsIntoStream", () => {
    it("should stream file contents to a writable stream", async () => {
      const chunks: Buffer[] = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });

      await s3Utils.getFileContentsIntoStream({
        bucket: TEST_BUCKET,
        key: testKey,
        writeStream,
      });

      const streamedContent = Buffer.concat(chunks).toString("utf-8");
      expect(streamedContent).toBe(testContent);
    });

    it("should handle large file streaming", async () => {
      const largeContent = "A".repeat(10000); // 10KB content
      const largeTestKey = `${testPrefix}/${timestamp}/large-file.txt`;
      const largeFileBuffer = Buffer.from(largeContent, "utf-8");
      await s3Client.send(
        new PutObjectCommand({
          Bucket: TEST_BUCKET,
          Key: largeTestKey,
          Body: largeFileBuffer,
          ContentType: "text/plain",
          Metadata: testMetadata,
        })
      );

      const chunks: Buffer[] = [];
      const writeStream = new Writable({
        write(chunk, _, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });

      await s3Utils.getFileContentsIntoStream({
        bucket: TEST_BUCKET,
        key: largeTestKey,
        writeStream,
      });

      const streamedContent = Buffer.concat(chunks).toString("utf-8");
      expect(streamedContent).toBe(largeContent);
      expect(streamedContent.length).toBe(10000);
    });

    it("should handle binary file streaming", async () => {
      const binaryContent = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0xff, 0xfe]); // "Hello" + null + binary
      const binaryTestKey = `${testPrefix}/${timestamp}/binary-file.bin`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: TEST_BUCKET,
          Key: binaryTestKey,
          Body: binaryContent,
          ContentType: "application/octet-stream",
          Metadata: testMetadata,
        })
      );
      const chunks: Buffer[] = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });

      await s3Utils.getFileContentsIntoStream({
        bucket: TEST_BUCKET,
        key: binaryTestKey,
        writeStream,
      });

      const streamedContent = Buffer.concat(chunks);
      expect(streamedContent).toEqual(binaryContent);
    });

    it("should throw error for non-existing file", async () => {
      const chunks: Buffer[] = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });

      await expect(
        s3Utils.getFileContentsIntoStream({
          bucket: TEST_BUCKET,
          key: "non-existing-key",
          writeStream,
        })
      ).rejects.toThrow();
    });

    it("should handle stream errors gracefully", async () => {
      const errorStream = new Writable({
        write(chunk, encoding, callback) {
          callback(new Error("Stream write error"));
        },
      });

      await expect(
        s3Utils.getFileContentsIntoStream({
          bucket: TEST_BUCKET,
          key: testKey,
          writeStream: errorStream,
        })
      ).rejects.toThrow("Stream write error");
    });
  });

  describe("getFileInfoFromS3", () => {
    it("should return file info for existing file", async () => {
      const fileInfo = await s3Utils.getFileInfoFromS3(testKey, TEST_BUCKET);

      expect(fileInfo).toMatchObject({
        exists: true,
        sizeInBytes: expect.any(Number),
        contentType: "text/plain",
        eTag: expect.any(String),
        createdAt: expect.any(Date),
        metadata: testMetadata,
      });
      expect(fileInfo.sizeInBytes).toBeGreaterThan(0);
    });

    it("should return exists: false for non-existing file", async () => {
      const fileInfo = await s3Utils.getFileInfoFromS3("non-existing-key", TEST_BUCKET);
      expect(fileInfo).toEqual({ exists: false });
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const exists = await s3Utils.fileExists(TEST_BUCKET, testKey);
      expect(exists).toBe(true);
    });

    it("should return false for non-existing file", async () => {
      const exists = await s3Utils.fileExists(TEST_BUCKET, "non-existing-key");
      expect(exists).toBe(false);
    });
  });

  describe("getSignedUrl", () => {
    it("should generate signed URL for file download", async () => {
      const signedUrl = await s3Utils.getSignedUrl({
        bucketName: TEST_BUCKET,
        fileName: testKey,
        durationSeconds: 300,
      });

      expect(signedUrl).toMatch(/^https:\/\/.*\.amazonaws\.com\/.*\?.*X-Amz-Algorithm=.*$/);
      expect(signedUrl).toContain(TEST_BUCKET);
      expect(signedUrl).toContain(testKey.replace(/:/g, "%3A"));
      const response = await fetch(signedUrl);
      expect(response.ok).toBe(true);
      const downloadedContent = await response.text();
      expect(downloadedContent).toBe(testContent);
    });

    it("should generate signed URL using location format", async () => {
      const signedUrl = await s3Utils.getSignedUrl({
        location: `https://${TEST_BUCKET}.s3.${TEST_REGION}.amazonaws.com/${testKey}`,
        durationSeconds: 300,
      });

      expect(signedUrl).toMatch(/^https:\/\/.*\.amazonaws\.com\/.*\?.*X-Amz-Algorithm=.*$/);
    });
  });

  describe("getPresignedUploadUrl", () => {
    it("should generate presigned URL for file upload", async () => {
      const presignedUrl = await s3Utils.getPresignedUploadUrl({
        bucket: TEST_BUCKET,
        key: testKey2,
        durationSeconds: 300,
        metadata: testMetadata,
      });

      expect(presignedUrl).toMatch(/^https:\/\/.*\.amazonaws\.com\/.*\?.*X-Amz-Algorithm=.*$/);
      expect(presignedUrl).toContain(TEST_BUCKET);
      expect(presignedUrl).toContain(testKey2.replace(/:/g, "%3A"));

      const uploadContent = "Content uploaded via presigned URL";
      const uploadBuffer = Buffer.from(uploadContent, "utf-8");

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: uploadBuffer,
        headers: {
          "Content-Type": "text/plain",
        },
      });
      expect(uploadResponse.ok).toBe(true);
      const fileExists = await checkFileExists(TEST_BUCKET, testKey2);
      expect(fileExists).toBe(true);
      const fileContent = await getFileContent(TEST_BUCKET, testKey2);
      expect(fileContent).toBe(uploadContent);
      const fileMetadata = await getFileMetadata(TEST_BUCKET, testKey2);
      expect(fileMetadata.contentType).toBe("text/plain");
      expect(fileMetadata.metadata).toEqual(testMetadata);
    });
  });

  describe("copyFile", () => {
    it("should copy file from one location to another", async () => {
      const copyKey = `integration-test-${Date.now()}/copied-file.txt`;

      await s3Utils.copyFile({
        fromBucket: TEST_BUCKET,
        fromKey: testKey,
        toBucket: TEST_BUCKET,
        toKey: copyKey,
      });

      const copiedFileExists = await checkFileExists(TEST_BUCKET, copyKey);
      expect(copiedFileExists).toBe(true);
      const copiedFileContent = await getFileContent(TEST_BUCKET, copyKey);
      expect(copiedFileContent).toBe(testContent);
      const copiedFileMetadata = await getFileMetadata(TEST_BUCKET, copyKey);
      expect(copiedFileMetadata.contentType).toBe("text/plain");
    });
  });

  describe("deleteFile", () => {
    it("should delete a file", async () => {
      const deleteKey = `integration-test-${Date.now()}/file-to-delete.txt`;
      const fileBuffer = Buffer.from("File to be deleted", "utf-8");
      const putCommand = new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: deleteKey,
        Body: fileBuffer,
        ContentType: "text/plain",
      });
      await s3Client.send(putCommand);
      const existsBefore = await checkFileExists(TEST_BUCKET, deleteKey);
      expect(existsBefore).toBe(true);

      await s3Utils.deleteFile({ bucket: TEST_BUCKET, key: deleteKey });

      const existsAfter = await checkFileExists(TEST_BUCKET, deleteKey);
      expect(existsAfter).toBe(false);
    });
  });

  describe("deleteFiles", () => {
    it("should delete multiple files", async () => {
      const keys = [
        `integration-test-${Date.now()}/multi-delete-1.txt`,
        `integration-test-${Date.now()}/multi-delete-2.txt`,
        `integration-test-${Date.now()}/multi-delete-3.txt`,
      ];
      for (const key of keys) {
        const fileBuffer = Buffer.from(`Content for ${key}`, "utf-8");
        await s3Utils.uploadFile({
          bucket: TEST_BUCKET,
          key: key,
          file: fileBuffer,
          contentType: "text/plain",
        });
      }
      const filesExistBefore = await checkFilesExist(TEST_BUCKET, keys);
      filesExistBefore.forEach(exists => expect(exists).toBe(true));

      await s3Utils.deleteFiles({ bucket: TEST_BUCKET, keys });

      const filesExistAfter = await checkFilesExist(TEST_BUCKET, keys);
      filesExistAfter.forEach(exists => expect(exists).toBe(false));
    });
  });

  describe("listObjects", () => {
    it("should list objects with prefix", async () => {
      const prefix = `integration-test-${Date.now()}/`;
      const testKeys = [`${prefix}list-test-1.txt`, `${prefix}list-test-2.txt`];
      for (const key of testKeys) {
        const fileBuffer = Buffer.from(`Content for ${key}`, "utf-8");
        await s3Utils.uploadFile({
          bucket: TEST_BUCKET,
          key: key,
          file: fileBuffer,
          contentType: "text/plain",
        });
      }
      const filesExist = await checkFilesExist(TEST_BUCKET, testKeys);
      filesExist.forEach(exists => expect(exists).toBe(true));

      const objects = await s3Utils.listObjects(TEST_BUCKET, prefix);

      expect(objects.length).toBeGreaterThanOrEqual(2);
      const objectKeys = objects.map(obj => obj.Key).filter(Boolean);
      expect(objectKeys).toEqual(expect.arrayContaining(testKeys));
    });
  });

  describe("buildFileUrl", () => {
    it("should build correct file URL", () => {
      const url = s3Utils.buildFileUrl(TEST_BUCKET, testKey);
      expect(url).toBe(`https://${TEST_BUCKET}.s3.${TEST_REGION}.amazonaws.com/${testKey}`);
    });
  });

  describe("getLocation", () => {
    it("should return correct S3 location", () => {
      const location = s3Utils.getLocation({ bucket: TEST_BUCKET, key: testKey });
      expect(location).toBe(`https://${TEST_BUCKET}.s3.${TEST_REGION}.amazonaws.com/${testKey}`);
    });
  });
});

async function deleteFiles({
  s3Client,
  bucket,
  prefix,
}: {
  s3Client: S3Client;
  bucket: string;
  prefix: string;
}) {
  const listCommand = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });
  const listed = await s3Client.send(listCommand);
  if (listed.Contents && listed.Contents.length > 0) {
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: listed.Contents.map(obj => ({ Key: obj.Key })),
      },
    });
    await s3Client.send(deleteCommand);
  }
}
