import { Bundle, Medication, MedicationStatement } from "@medplum/fhirtypes";
import fs from "fs";
import { faker } from "@faker-js/faker";
import { removeEmptyFields } from "../../../clinical-document/clinical-document";
import { xmlBuilder } from "../../../clinical-document/shared";
import { buildMedications } from "../../medications";
import path from "path";
import { makeMedicationStatementPair, makeMedicationStatementPair2 } from "./medication";
import { createEmptyBundle, getPastDateInDifferentFormats } from "../shared";
import { NOT_SPECIFIED } from "../../../constants";

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

    const filePath = path.join(__dirname, "medications-section.xml");
    const xmlTemplate = fs.readFileSync(filePath, "utf8");

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const params = {
      NOT_SPECIFIED,
      medStmntId,
      pastDateCda,
      pastDateHumanReadable,
    };
    // TODO: Remove the console.log after we fix the tsconfig to ignore "unused" vars,
    // since `eval()` isn't explicitly using them
    console.log("params", params);

    const xmlContent = eval("`" + xmlTemplate + "`");
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

    const filePath = path.join(__dirname, "medications-section-2.xml");
    const xmlTemplate = fs.readFileSync(filePath, "utf8");

    /* eslint-disable @typescript-eslint/no-unused-vars */
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
    // TODO: Remove the console.log after we fix the tsconfig to ignore "unused" vars,
    // since `eval()` isn't explicitly using them
    console.log("params", params);

    const xmlContent = eval("`" + xmlTemplate + "`");
    const res = buildMedications(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
