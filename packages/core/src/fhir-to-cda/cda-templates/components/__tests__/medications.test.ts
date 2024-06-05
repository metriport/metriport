import { faker } from "@faker-js/faker";
import { Bundle, Medication, MedicationStatement } from "@medplum/fhirtypes";
import _ from "lodash";
import path from "path";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { NOT_SPECIFIED } from "../../constants";
import { buildMedications } from "../medications";
import { makeMedicationStatementPair, makeMedicationStatementPair2 } from "./medication";
import { createEmptyBundle, getPastDateInDifferentFormats, getXmlContentFromFile } from "./shared";

let medStmntId: string;
let medId: string;
let pastDateIso: string;
let pastDateCda: string | undefined;
let pastDateHumanReadable: string | undefined;
let bundle: Bundle;
let medStatement: MedicationStatement;
let med: Medication;

beforeEach(() => {
  medStmntId = faker.string.uuid();
  medId = faker.string.uuid();
  const { dateIso, dateHumanReadable, dateCda } = getPastDateInDifferentFormats();
  pastDateIso = dateIso;
  pastDateCda = dateCda;
  pastDateHumanReadable = dateHumanReadable;

  const { medicationStatement, medication } = makeMedicationStatementPair(
    medStmntId,
    medId,
    pastDateIso
  );
  medStatement = medicationStatement;
  med = medication;

  bundle = createEmptyBundle();
});

describe("buildMedications", () => {
  it("throws an error if the Bundle is missing a Medication", () => {
    bundle.entry?.push({ resource: medStatement });
    expect(() => buildMedications(bundle)).toThrow();
  });

  it("throws an error if MedicationStatement incorrectly references a Medication", () => {
    bundle.entry?.push({ resource: medStatement });
    const medicationWithAlteredId = {
      ...med,
      id: "SomethingElse",
    };
    bundle.entry?.push({ resource: medicationWithAlteredId });
    expect(() => buildMedications(bundle)).toThrow();
  });

  it("correctly maps a single MedicationStatement with a related Medication", () => {
    bundle.entry?.push({ resource: medStatement });
    bundle.entry?.push({ resource: med });
    const filePath = path.join(__dirname, "./xmls/medications-section-single-entry.xml");
    const params = {
      NOT_SPECIFIED,
      medStmntId,
      pastDateCda,
      pastDateHumanReadable,
    };
    const xmlTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = xmlTemplate(params);
    const res = buildMedications(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps two MedicationStatements with related Medications", () => {
    bundle.entry?.push({ resource: medStatement });
    bundle.entry?.push({ resource: med });

    const medStmntId2 = faker.string.uuid();
    const medId2 = faker.string.uuid();
    const {
      dateIso: pastDateFhir2,
      dateCda: pastDateXml2,
      dateHumanReadable: pastDateHumanReadable2,
    } = getPastDateInDifferentFormats(3);
    const {
      dateIso: endDateFhir,
      dateCda: endDateXml,
      dateHumanReadable: endDateHumanReadable,
    } = getPastDateInDifferentFormats(2);

    const { medicationStatement2, medication2 } = makeMedicationStatementPair2(
      medStmntId2,
      medId2,
      pastDateFhir2,
      endDateFhir
    );

    bundle.entry?.push({ resource: medicationStatement2 });
    bundle.entry?.push({ resource: medication2 });
    const filePath = path.join(__dirname, "./xmls/medications-section-two-entries.xml");
    const params = {
      NOT_SPECIFIED,
      medStmntId,
      pastDateCda,
      pastDateHumanReadable,
      medStmntId2,
      pastDateCda2: pastDateXml2,
      pastDateHumanReadable2,
      endDateXml,
      endDateHumanReadable,
    };
    const xmlTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = xmlTemplate(params);
    const res = buildMedications(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
