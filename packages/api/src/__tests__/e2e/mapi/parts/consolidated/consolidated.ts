import { AllergyIntolerance, Binary, Bundle, DocumentReference } from "@medplum/fhirtypes";
import { makeDocumentReference } from "@metriport/core/external/fhir/document/__tests__/document-reference";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { makeAllergyIntollerance } from "@metriport/core/external/fhir/__tests__/allergy-intolerance";
import { makeBinary } from "@metriport/core/external/fhir/__tests__/binary";
import { PatientWithId } from "@metriport/core/external/fhir/__tests__/patient";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import fs from "fs";
import { template } from "lodash";
import { e2eResultsFolderName } from "../../../shared";

dayjs.extend(utc);

export function createConsolidatedPayloads(patient: PatientWithId): {
  consolidated: Bundle;
  allergyIntolerance: AllergyIntolerance;
  documentReference: DocumentReference;
  binary: Binary;
} {
  const extension = [metriportDataSourceExtension];
  const allergyIntolerance = makeAllergyIntollerance({ patient });
  const binary = makeBinary();
  const documentReference = makeDocumentReference({ patient, extension, binary });
  const entry: Bundle["entry"] = [
    {
      resource: { ...allergyIntolerance },
    },
    {
      resource: { ...documentReference },
    },
  ];
  return {
    consolidated: {
      resourceType: "Bundle",
      type: "collection",
      total: entry.length,
      entry,
    },
    allergyIntolerance,
    documentReference,
    binary,
  };
}

/**
 * Ignores the "meta" field in all resources.
 */
export function checkConsolidatedJson({
  patientId,
  lastName,
  phone,
  email,
  allergyId,
  documentId,
  binaryId,
  ...params
}: {
  patientId: string;
  lastName: string;
  phone: string;
  email: string;
  allergyId: string;
  documentId: string;
  binaryId: string;
} & Consolidated): boolean {
  const templateParams = { patientId, lastName, phone, email, allergyId, documentId, binaryId };
  const contentProcessor = (template: string) => {
    // Removes the "meta" field from the JSON, it contains dynamic data that we can't predict
    return template.replace(/"meta":\s*\{[^}]+\},/g, "");
  };
  return checkConsolidated({
    ...params,
    templateParams,
    contentProcessor,
    extension: "json",
  });
}

export function checkConsolidatedHtml({
  patientId,
  lastName,
  ...params
}: {
  patientId: string;
  lastName: string;
} & Consolidated): boolean {
  const templateParams = { patientId, lastName };
  return checkConsolidated({ ...params, templateParams, extension: "html" });
}

type Consolidated = {
  contents: string;
  outputExpectedFileName?: string;
  outputReceivedFileName?: string;
};

function checkConsolidated({
  contents,
  templateParams,
  contentProcessor,
  extension,
  outputExpectedFileName = "consolidated-expected",
  outputReceivedFileName = "consolidated-received",
}: {
  templateParams: Record<string, string>;
  contentProcessor?: (template: string) => string;
  extension: string;
} & Consolidated): boolean {
  const date = dayjs().utc().format("YYYY-MM-DD");

  const templateContents = fs.readFileSync(`${__dirname}/consolidated-template.${extension}`, {
    encoding: "utf8",
  });
  const interpolate = template(templateContents);
  const interpolatedContents = interpolate({ date, ...templateParams })
    .toString()
    .trim();
  const expectedContents = (
    contentProcessor ? contentProcessor(interpolatedContents) : interpolatedContents
  ).trim();
  const receivedContents = (contentProcessor ? contentProcessor(contents) : contents).trim();

  const isMatch = receivedContents === expectedContents;
  if (!isMatch) {
    fs.writeFileSync(
      `${e2eResultsFolderName}/${outputExpectedFileName}.${extension}`,
      expectedContents
    );
    fs.writeFileSync(
      `${e2eResultsFolderName}/${outputReceivedFileName}.${extension}`,
      receivedContents
    );
  }
  return isMatch;
}
