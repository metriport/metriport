import { DOMParser } from "xmldom";

// TO BE RUN LOCALLY NOT IN CI/CD
describe.skip("document-downloader", () => {
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

    const xmlBodyTexts = nonXMLBody?.getElementsByTagName("text");
    const b64 = xmlBodyTexts?.[0]?.textContent ?? "";

    expect(b64).toEqual("abc123");
  });
});
