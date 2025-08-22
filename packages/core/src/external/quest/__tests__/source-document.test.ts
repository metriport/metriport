import {
  splitAllResponseFilesIntoSourceDocuments,
  splitResponseFileIntoSourceDocuments,
} from "../source-document";
import { getArtifact } from "./shared";

describe("Quest source document generator", () => {
  it("should split a response file into source documents with a single patient", () => {
    const responseFile = getArtifact("response/single-patient.txt");
    const sourceDocuments = splitResponseFileIntoSourceDocuments({
      fileName: "Metriport_202501010102.txt",
      fileContent: responseFile,
    });
    expect(sourceDocuments.length).toBe(1);
    const firstSourceDocument = sourceDocuments[0];
    if (!firstSourceDocument) return;

    // The file only has one patient, so there should only be a single source document
    expect(firstSourceDocument.fileName).toBe(
      "ptId=0A1B2C3D4E5F6G7/dateId=202501010102/0A1B2C3D4E5F6G7_202501010102_source.tsv"
    );
    expect(firstSourceDocument.fileContent.toString()).toBe(responseFile.toString());
    expect(firstSourceDocument.patientId).toBe("0A1B2C3D4E5F6G7");
  });

  it("should split multiple response files into source documents", () => {
    const responseFile1 = getArtifact("response/single-patient.txt");
    const responseFile2 = getArtifact("response/multiple-patients.txt");
    const sourceDocuments = splitAllResponseFilesIntoSourceDocuments([
      {
        fileName: "Metriport_202501010102.txt",
        fileContent: responseFile1,
      },
      {
        fileName: "Metriport_202501010103.txt",
        fileContent: responseFile2,
      },
    ]);
    expect(sourceDocuments.length).toBe(3);
  });
});
