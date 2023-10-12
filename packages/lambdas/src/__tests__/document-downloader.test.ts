import { DOMParser } from "xmldom";
import {
  downloadDocumentFromCW,
  getUploadStreamToS3,
  getFileInfoFromS3,
  returnB64FromXMLBody,
} from "../document-downloader";
import { getEnvOrFail } from "../shared/env";

const cwOrgCertificate = getEnvOrFail("CW_ORG_CERTIFICATE");
const cwOrgPrivateKey = getEnvOrFail("CW_ORG_PRIVATE_KEY");
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

// TODO move these to .env so we don't need to update the test file to run it
const docRef = {
  fileName: "",
  fileLocation: "",
  mimeType: "",
  size: 0,
};

// TODO move these to .env so we don't need to update the test file to run it
const org = {
  orgName: "",
  orgOid: "",
  npi: "",
};

// TO BE RUN LOCALLY NOT IN CI/CD
describe.skip("document-downloader", () => {
  it("should download the document from cw and store in s3", async () => {
    const { writeStream, promise } = getUploadStreamToS3(
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

    const parser = new DOMParser();

    const document = parser.parseFromString(xml, "text/xml");

    const nonXMLBody = document.getElementsByTagName("nonXMLBody")[0];

    const b64 = returnB64FromXMLBody(nonXMLBody);

    expect(b64).toEqual("abc123");
  });
});
