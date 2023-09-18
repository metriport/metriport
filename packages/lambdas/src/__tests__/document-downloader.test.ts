import {
  downloadDocumentFromCW,
  uploadDocumentToS3,
  getFileInfoFromS3,
  removeAndReturnB64FromXML,
} from "../document-downloader";

// TO BE RUN LOCALLY NOT IN CI/CD
const cwOrgCertificate = ``;
const cwOrgPrivateKey = ``;
const bucketName = ``;

const file = {
  fileName: "",
  fileLocation: "",
  mimeType: "",
};

const org = {
  orgName: "",
  orgOid: "",
  npi: "",
};

describe("document-downloader", () => {
  it("should return a result", async () => {
    const { writeStream, promise } = uploadDocumentToS3(file.fileName, bucketName, file.mimeType);

    await downloadDocumentFromCW({
      orgCertificate: cwOrgCertificate,
      orgPrivateKey: cwOrgPrivateKey,
      orgName: org.orgName,
      orgOid: org.orgOid,
      npi: org.npi,
      location: file.fileLocation,
      stream: writeStream,
    });

    const uploadResult = await promise;

    expect(uploadResult).toBeTruthy();
    expect(uploadResult.Key).toEqual(file.fileName);

    const { size, contentType } = await getFileInfoFromS3(uploadResult.Key, uploadResult.Bucket);

    expect(size).toBeTruthy();
    expect(contentType).toEqual(file.mimeType);
  });

  it("should remove base64 from xml", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <ClinicalDocument>
      <component typeCode="COMP" contextConductionInd="true">
        <nonXMLBody classCode="DOCBODY" moodCode="EVN">
          <text mediaType="application/pdf" representation="B64">
            abc123
          </text>
        </nonXMLBody>
      </component>
    </ClinicalDocument>`;

    const { newXML, b64 } = removeAndReturnB64FromXML(xml);

    const hasText = newXML.includes("<text>");
    const hasB64 = newXML.includes("abc123");

    expect(hasText).toEqual(false);
    expect(hasB64).toEqual(false);

    expect(b64).toEqual("abc123");
  });
});
