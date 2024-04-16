import { cleanUpPayload } from "../sqs-to-converter/cleanup";

describe("sqs-to-converter", () => {
  describe("cleanUpPayload", () => {
    it("returns original xml when no UNK and no nullFlavor", async () => {
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
      const res = cleanUpPayload(xml);
      expect(res).toEqual(xml);
    });
  });
});
