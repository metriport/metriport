import { Bundle, Medication, MedicationStatement } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { NOT_SPECIFIED } from "../../constants";
import { buildMedications } from "../medications";
import { createEmptyBundle, getPastDateInDifferentFormats } from "./shared";

let medStmntId: string;
let medId: string;
let pastDateFhir: string;
let pastDateHumanReadable: string | undefined;
let pastDateXml: string | undefined;
let bundle: Bundle;
let expectedXml: string;
let medicationStatement: MedicationStatement;
let medication: Medication;

beforeEach(() => {
  medStmntId = uuidv7();
  medId = uuidv7();
  const { dateFhir, dateHumanReadable, dateXml } = getPastDateInDifferentFormats();
  pastDateFhir = dateFhir;
  pastDateHumanReadable = dateHumanReadable;
  pastDateXml = dateXml;

  medicationStatement = {
    resourceType: "MedicationStatement",
    id: medStmntId,
    status: "active",
    medicationReference: {
      reference: `Medication/${medId}`,
    },
    subject: {
      reference: `Patient/${uuidv7()}`,
    },
    effectivePeriod: {
      start: pastDateFhir,
    },
    reasonCode: [
      {
        text: "heart",
      },
    ],
    dosage: [
      {
        doseAndRate: [
          {
            doseQuantity: {
              value: 6.25,
              unit: "mg (milligram)",
            },
            rateQuantity: {
              value: 1,
              unit: "pill/day",
            },
          },
        ],
      },
    ],
  };

  medication = {
    resourceType: "Medication",
    id: medId,
    code: {
      text: "CARVEDILOL",
      coding: [
        {
          code: "315577",
          display: "carvedilol 6.25 MG",
          system: "2.16.840.1.113883.6.88",
        },
        {
          code: "51407-040",
          display: "Carvedilol",
          system: "2.16.840.1.113883.6.69",
        },
      ],
    },
  };

  bundle = createEmptyBundle();
});

describe("buildMedications", () => {
  it("throws an error if the Bundle is missing a Medication", () => {
    bundle.entry?.push({ resource: medicationStatement });
    expect(() => buildMedications(bundle)).toThrow();
  });

  it("throws an error if MedicationStatement incorrectly references a Medication", () => {
    bundle.entry?.push({ resource: medicationStatement });
    const medicationWithAlteredId = {
      ...medication,
      id: "SomethingElse",
    };
    bundle.entry?.push({ resource: medicationWithAlteredId });
    expect(() => buildMedications(bundle)).toThrow();
  });

  it("correctly maps a single MedicationStatement with a related Medication", () => {
    bundle.entry?.push({ resource: medicationStatement });
    bundle.entry?.push({ resource: medication });

    expectedXml = `<component><section><templateId root="2.16.840.1.113883.10.20.22.2.1.1"></templateId><code code="10160-0" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="History of Medication use Narrative"></code><title>MEDICATIONS</title><text><table ID="medications"><thead><tr><th>Medication</th><th>Code</th><th>Dosage</th><th>Frequency</th><th>Start Date</th><th>End Date</th><th>Reason</th></tr></thead><tbody><tr ID="medications1"><td>CARVEDILOL</td><td>315577 - 2.16.840.1.113883.6.88</td><td>6.25 mg (milligram)</td><td>1 pill/day</td><td>${pastDateHumanReadable}</td><td>${NOT_SPECIFIED}</td><td>heart</td></tr></tbody></table></text><entry><substanceAdministration classCode="SBADM" moodCode="INT"><templateId root="2.16.840.1.113883.10.20.22.4.16" extension="2014-06-09"></templateId><id root="placeholder-ORG-OID" extension="${medStmntId}"></id><statusCode code="active"></statusCode><effectiveTime xsi:type="IVL_TS"><low value="${pastDateXml}"></low></effectiveTime><consumable typeCode="CSM"><manufacturedProduct><templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"></templateId><manufacturedMaterial><code code="315577" codeSystem="2.16.840.1.113883.6.88" displayName="carvedilol 6.25 MG"><originalText><reference value="medications1"></reference></originalText><translation code="315577" codeSystem="2.16.840.1.113883.6.88" displayName="carvedilol 6.25 MG"></translation><translation code="51407-040" codeSystem="2.16.840.1.113883.6.69" displayName="Carvedilol"></translation></code></manufacturedMaterial></manufacturedProduct></consumable></substanceAdministration></entry></section></component>`;
    const res = buildMedications(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toBe(expectedXml);
  });

  it("correctly maps two MedicationStatements with related Medications", () => {
    bundle.entry?.push({ resource: medicationStatement });
    bundle.entry?.push({ resource: medication });

    const medStmntId2 = uuidv7();
    const medId2 = uuidv7();
    const {
      dateFhir: pastDateFhir2,
      dateXml: pastDateXml2,
      dateHumanReadable: pastDateHumanReadable2,
    } = getPastDateInDifferentFormats(3);
    const {
      dateFhir: endDateFhir,
      dateXml: endDateXml,
      dateHumanReadable: endDateHumanReadable,
    } = getPastDateInDifferentFormats(2);
    const medicationStatement2: MedicationStatement = {
      resourceType: "MedicationStatement",
      id: medStmntId2,
      status: "completed",
      medicationReference: {
        reference: `Medication/${medId2}`,
      },
      subject: {
        reference: `Patient/${uuidv7()}`,
      },
      effectivePeriod: {
        start: pastDateFhir2,
        end: endDateFhir,
      },
      reasonCode: [
        {
          text: "GERD",
        },
      ],
      dosage: [
        {
          doseAndRate: [
            {
              doseQuantity: {
                value: 20,
                unit: "mg (milligram)",
              },
              rateQuantity: {
                value: 2,
                unit: "capsule/day",
              },
            },
          ],
        },
      ],
    };

    const medication2: Medication = {
      resourceType: "Medication",
      id: medId2,
      code: {
        text: "OMEPRAZOLE",
        coding: [
          {
            code: "646344",
            display: "omeprazole 20 MG / sodium bicarbonate 1100 MG Oral Capsule",
            system: "2.16.840.1.113883.6.88",
          },
        ],
      },
    };

    bundle.entry?.push({ resource: medicationStatement2 });
    bundle.entry?.push({ resource: medication2 });

    expectedXml = `<component><section><templateId root="2.16.840.1.113883.10.20.22.2.1.1"></templateId><code code="10160-0" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="History of Medication use Narrative"></code><title>MEDICATIONS</title><text><table ID="medications"><thead><tr><th>Medication</th><th>Code</th><th>Dosage</th><th>Frequency</th><th>Start Date</th><th>End Date</th><th>Reason</th></tr></thead><tbody><tr ID="medications1"><td>CARVEDILOL</td><td>315577 - 2.16.840.1.113883.6.88</td><td>6.25 mg (milligram)</td><td>1 pill/day</td><td>${pastDateHumanReadable}</td><td>${NOT_SPECIFIED}</td><td>heart</td></tr><tr ID="medications2"><td>OMEPRAZOLE</td><td>646344 - 2.16.840.1.113883.6.88</td><td>20 mg (milligram)</td><td>2 capsule/day</td><td>${pastDateHumanReadable2}</td><td>${endDateHumanReadable}</td><td>GERD</td></tr></tbody></table></text><entry><substanceAdministration classCode="SBADM" moodCode="INT"><templateId root="2.16.840.1.113883.10.20.22.4.16" extension="2014-06-09"></templateId><id root="placeholder-ORG-OID" extension="${medStmntId}"></id><statusCode code="active"></statusCode><effectiveTime xsi:type="IVL_TS"><low value="${pastDateXml}"></low></effectiveTime><consumable typeCode="CSM"><manufacturedProduct><templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"></templateId><manufacturedMaterial><code code="315577" codeSystem="2.16.840.1.113883.6.88" displayName="carvedilol 6.25 MG"><originalText><reference value="medications1"></reference></originalText><translation code="315577" codeSystem="2.16.840.1.113883.6.88" displayName="carvedilol 6.25 MG"></translation><translation code="51407-040" codeSystem="2.16.840.1.113883.6.69" displayName="Carvedilol"></translation></code></manufacturedMaterial></manufacturedProduct></consumable></substanceAdministration></entry><entry><substanceAdministration classCode="SBADM" moodCode="INT"><templateId root="2.16.840.1.113883.10.20.22.4.16" extension="2014-06-09"></templateId><id root="placeholder-ORG-OID" extension="${medStmntId2}"></id><statusCode code="completed"></statusCode><effectiveTime xsi:type="IVL_TS"><low value="${pastDateXml2}"></low><high value="${endDateXml}"></high></effectiveTime><consumable typeCode="CSM"><manufacturedProduct><templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"></templateId><manufacturedMaterial><code code="646344" codeSystem="2.16.840.1.113883.6.88" displayName="omeprazole 20 MG / sodium bicarbonate 1100 MG Oral Capsule"><originalText><reference value="medications2"></reference></originalText><translation code="646344" codeSystem="2.16.840.1.113883.6.88" displayName="omeprazole 20 MG / sodium bicarbonate 1100 MG Oral Capsule"></translation></code></manufacturedMaterial></manufacturedProduct></consumable></substanceAdministration></entry></section></component>`;
    const res = buildMedications(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toBe(expectedXml);
  });
});
