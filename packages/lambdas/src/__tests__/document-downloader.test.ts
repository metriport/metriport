import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else

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

const docRef = {
  fileName: "",
  fileLocation: "",
  mimeType: "",
  size: 0,
};

const org = {
  orgName: "",
  orgOid: "",
  npi: "",
};

describe.skip("document-downloader", () => {
  it("should download the document from cw and store in s3", async () => {
    const { writeStream, promise } = uploadDocumentToS3(
      docRef.fileName,
      bucketName,
      docRef.mimeType
    );

    await downloadDocumentFromCW({
      orgCertificate: cwOrgCertificate,
      orgPrivateKey: cwOrgPrivateKey,
      orgName: org.orgName,
      orgOid: org.orgOid,
      npi: org.npi,
      location: docRef.fileLocation,
      stream: writeStream,
    });

    const uploadResult = await promise;

    expect(uploadResult).toBeTruthy();
    expect(uploadResult.Key).toEqual(docRef.fileName);

    const { size, contentType } = await getFileInfoFromS3(uploadResult.Key, uploadResult.Bucket);

    expect(size).toEqual(docRef.size);
    expect(contentType).toEqual(docRef.mimeType);
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
