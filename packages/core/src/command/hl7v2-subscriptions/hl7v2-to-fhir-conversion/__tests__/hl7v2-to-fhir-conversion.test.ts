import { Hl7Message } from "@medplum/core";
import { convertHl7v2MessageToFhir, ResourceWithExtension } from "..";
import { Bundle } from "@medplum/fhirtypes";
import * as configModule from "../../../../util/config";

describe("Hl7v2 to FHIR conversion", () => {
  const hl7Msg = `MSH|^~|HEALTHSHARE|HMHW|METRIPORTPA|METRIPORTPA|20250507034313||ADT^A03|100000^111222333|P|2.5.1
EVN|A03|20250102060000|||||AHHH^SOMEWHERE
PID|1||cOEe2QLs2M43J1X3ER1bNu==_RWpXFS0oT3+BKiMrFHHvYu==^^METRIPORTPA^MR|123456789^^^ABCDEF^MR|LAST^FIRST^MIDDLE^^^^||1111111|F||C^^L|SOMEWHERE^77777^USA^L^^THOMAS||(666)-666-6666^^||^^L|^^L|^^L|2101206259758|000-00-0000|||^^L||||||||N
PV1|1|O|^^^^||||10000000^SMITH^JANE^^^^^^^^^^NPI|||||||2|||||10000|||||||||||||||||||||||||20250829024816|20250830024816
PV2|1|^^L||||||20250502180000||||PRE-ADMISSION TESTING VISIT||||||||||N|SOMEWHERE|||||||||N
DG1|1|I10|I65.21^Occlusion and stenosis of right carotid artery^I10|Occlusion and stenosis of right carotid |20250101181500
DG1|2|I10|Z01.818^Encounter for other preprocedural examination^I10|Encounter for other preprocedural examin
DG1|2|I10|E11.9^Type 2 diabetes mellitus without complications^I10|Type 2 diabetes mellitus without complications
DG1|3|I10|I10.9^Essential (primary) hypertension^I10|Essential (primary) hypertension
DG1|4|I10|E78.5^Dyslipidemia^I10|Dyslipidemia
DG1|5|I10|E03.9^Hypothyroidism, unspecified^I10|Hypothyroidism, unspecified
`;
  const hl7Message = Hl7Message.parse(hl7Msg);
  const cxId = "1000000";
  const patientId = "1000000";

  const DOC_ID_URL = "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json";
  const DATA_SOURCE_URL = "https://public.metriport.com/fhir/StructureDefinition/data-source.json";

  beforeEach(() => {
    jest.spyOn(configModule.Config, "getHl7Base64ScramblerSeed").mockReturnValue("unit-test-seed");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("Converter adds datasource and docId extensions", () => {
    const fileName = "someFileName";
    const expectedFileKey = "location_hl7/someFileName";
    const hieName = "TestHIE";
    const expectedCode = hieName.toUpperCase();

    const bundle = convertHl7v2MessageToFhir({
      message: hl7Message,
      cxId,
      patientId,
      rawDataFileKey: fileName,
      hieName,
    }) as Bundle;

    expect(bundle.entry?.length).toBeGreaterThan(0);
    if (!bundle.entry) {
      throw new Error("No entries in bundle after hl7message -> FHIR conversion");
    }
    for (const entry of bundle.entry) {
      expect(entry.resource).toBeDefined();

      const ext = (entry.resource as ResourceWithExtension).extension;
      expect(ext).toBeDefined();
      expect(ext).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: DOC_ID_URL,
            valueString: expectedFileKey,
          }),
        ])
      );
      expect(ext).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: DATA_SOURCE_URL,
            valueCoding: {
              system: DATA_SOURCE_URL,
              code: expectedCode,
            },
          }),
        ])
      );
    }
  });
});
