import { faker } from "@faker-js/faker";
import {
  AllergyIntolerance,
  Binary,
  Bundle,
  Condition,
  DocumentReference,
  Encounter,
  Location,
  Practitioner,
} from "@medplum/fhirtypes";
import { conversionBundleSuffix } from "@metriport/core/command/consolidated/consolidated-create";
import { deleteConsolidated } from "@metriport/core/command/consolidated/consolidated-delete";
import { createFilePath } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { makeDocumentReference } from "@metriport/core/external/fhir/document/__tests__/document-reference";
import { buildBundleEntry } from "@metriport/core/external/fhir/shared/bundle";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { makeBinary } from "@metriport/core/external/fhir/__tests__/binary";
import { PatientWithId } from "@metriport/core/external/fhir/__tests__/patient";
import { makeReference } from "@metriport/core/external/fhir/__tests__/reference";
import { snomedCodeMd } from "@metriport/core/fhir-deduplication/__tests__/examples/condition-examples";
import { makeAllergyMedication } from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-allergy";
import { makeCondition } from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-condition";
import {
  makeEncounter,
  makeLocation,
  makePractitioner,
} from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { getEnvVarOrFail } from "@metriport/shared";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import fs from "fs";
import { template } from "lodash";
import { Config } from "../../../../../shared/config";
import { e2eResultsFolderName } from "../../../shared";
import { cxId, E2eContext } from "../../shared";

dayjs.extend(utc);

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3BucketName = getEnvVarOrFail("CONVERSION_RESULT_BUCKET_NAME");

export function createConsolidatedPayloads(patient: PatientWithId): {
  consolidated: Bundle;
  allergyIntolerance: AllergyIntolerance;
  condition: Condition;
  encounter: Encounter;
  location: Location;
  practitioner: Practitioner;
  documentReference: DocumentReference;
  binary: Binary;
} {
  const patientReference = makeReference(patient);
  const allergyIntolerance = makeAllergyMedication({ patient: patientReference });
  const dateTime = { start: "2012-01-01T10:00:00.000Z" };
  const condition = makeCondition(
    {
      id: faker.string.uuid(),
      code: { coding: [snomedCodeMd] },
      onsetPeriod: dateTime,
    },
    patient.id
  );
  const practitioner = makePractitioner();
  const location = makeLocation();
  const encounter: Encounter = makeEncounter(
    {
      id: faker.string.uuid(),
      diagnosis: [{ condition: { reference: `Condition/${condition.id}` } }],
      period: {
        start: "2013-08-22T17:05:00.000Z",
        end: "2013-08-22T18:15:00.000Z",
      },
    },
    { patient: patient.id, loc: location.id, pract: practitioner.id }
  );
  const binary = makeBinary();
  const documentReference = makeDocumentReference({
    patient,
    extension: [metriportDataSourceExtension],
    binary,
  });
  const entry: Bundle["entry"] = [condition, encounter, allergyIntolerance, documentReference].map(
    buildBundleEntry
  );
  return {
    consolidated: {
      resourceType: "Bundle",
      type: "collection",
      total: entry.length,
      entry,
    },
    allergyIntolerance,
    condition,
    encounter,
    location,
    practitioner,
    documentReference,
    binary,
  };
}

/**
 * Ignores the "meta" field in all resources.
 */
export function checkConsolidatedJson(
  contents: string,
  params: {
    cxId: string;
    patientId: string;
    lastName: string;
    phone: string;
    email: string;
    allergyId: string;
    conditionId: string;
    encounterId: string;
    locationId: string;
    practitionerId: string;
    documentId: string;
    binaryId: string;
    requestId: string;
  }
): boolean {
  const contentProcessor = (template: string) => {
    // Removes the "meta" field from the JSON, it contains dynamic data that we can't predict
    return template.replace(/"meta":\s*\{[^}]+\},/g, "");
  };
  return checkConsolidated({
    contents,
    templateParams: params,
    contentProcessor,
    extension: "json",
  });
}

export function checkConsolidatedHtml({
  patientId,
  lastName,
  allergyId,
  ...params
}: {
  patientId: string;
  lastName: string;
  allergyId: string;
} & Consolidated): boolean {
  const templateParams = { patientId, lastName, allergyId };
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

  // For JSON, it has to be minified (no new lines or spaces - DevUtils can do it!)
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

export function makeConversionFileName({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  const fileId = `e2e_${new Date().toISOString()}${conversionBundleSuffix}`;
  const key = createFilePath(cxId, patientId, fileId);
  return key;
}

export async function prepareConsolidatedTests(e2e: E2eContext) {
  if (!e2e.patient) throw new Error("Missing patient");
  if (!e2e.patientFhir) throw new Error("Missing patientFhir");
  const payloads = createConsolidatedPayloads(e2e.patientFhir);
  e2e.consolidatedPayload = payloads.consolidated;
  e2e.allergyIntolerance = payloads.allergyIntolerance;
  e2e.condition = payloads.condition;
  e2e.encounter = payloads.encounter;
  e2e.location = payloads.location;
  e2e.practitioner = payloads.practitioner;
  e2e.documentReference = payloads.documentReference;
  e2e.binary = payloads.binary;
  async function storeConversionOnS3(patientId: string) {
    const key = makeConversionFileName({ cxId, patientId });
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify(e2e.consolidatedPayload)),
      contentType: "application/json",
    });
  }
  await Promise.all([
    storeConversionOnS3(e2e.patient.id),
    deleteConsolidated({
      cxId,
      patientId: e2e.patient.id,
    }),
  ]);
}
