import { S3Utils } from "../../aws/s3";
import { buildSourceDocumentFileName } from "../file/file-names";
import { parseResponseFile } from "../file/file-parser";
import { QuestReplica } from "../replica";
import { uploadSourceDocuments } from "../source-document";
import { QuestPatientResponseFile } from "../types";
import { getArtifact } from "./shared";

describe("Source document upload", () => {
  const bucketName = "metriport-quest-replica-staging";
  const region = "us-east-2";
  const replica = new QuestReplica({
    replicaBucket: bucketName,
    replicaBucketRegion: region,
    incomingDirectory: "/IN",
  });

  it("should generate a source document for a single patient", async () => {
    const fileContent = getArtifact("response/single-patient.txt");
    const patientId = "0A1B2C3D4E5F6G7";
    const fileName = buildSourceDocumentFileName({
      patientId,
      dateId: "202501010102",
    });
    const sourceDocument: QuestPatientResponseFile = {
      patientId,
      fileName,
      fileContent,
    };

    await uploadSourceDocuments(replica, [sourceDocument]);

    // Separate validation to ensure the source document was written
    const s3Utils = new S3Utils(region);
    const fileExists = await s3Utils.fileExists(bucketName, "source_document/" + fileName);
    expect(fileExists).toBe(true);
  });

  it("should list all source documents", async () => {
    const responseFiles = await replica.listAllResponseFiles();
    expect(responseFiles.length > 0).toBe(true);

    for (const responseFile of responseFiles) {
      const parsedRows = parseResponseFile(responseFile.fileContent);
      expect(parsedRows.length > 0).toBe(true);
    }
  });
});
