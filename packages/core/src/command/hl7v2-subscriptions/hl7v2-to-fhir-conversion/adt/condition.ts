import { Hl7Message, Hl7Segment } from "@medplum/core";
import { CodeableConcept, Condition, EncounterDiagnosis } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import {
  buildConditionReference,
  buildPatientReference,
} from "../../../../external/fhir/shared/references";
import { deduplicateConditions } from "../../../../fhir-deduplication/resources/condition";
import { getCoding } from "./utils";

type ConditionWithId = Condition & {
  id: string;
};

type EncounterReason = {
  reasonCode: CodeableConcept[];
  condition: Condition;
  diagnosis: EncounterDiagnosis[];
};

type ConditionWithCode = Partial<Condition> & {
  code: CodeableConcept;
};

export function getConditions({
  adt,
  patientId,
  encounterId,
}: {
  adt: Hl7Message;
  patientId: string;
  encounterId: string;
}): Condition[] {
  const dg1Segments = adt.getAllSegments("DG1");
  const conditions = dg1Segments.flatMap(
    dg1 => getConditionFromDg1Segment(dg1, patientId, encounterId) ?? []
  );

  const uniqueConditions = deduplicateConditions(conditions, false).combinedResources;
  return uniqueConditions;
}

export function getEncounterReason({
  adt,
  patientId,
  encounterId,
}: {
  adt: Hl7Message;
  patientId: string;
  encounterId: string;
}): EncounterReason | undefined {
  const pv2Segment = adt.getSegment("PV2");
  if (!pv2Segment || pv2Segment.fields.length < 1) return undefined;

  const codedConditionField = pv2Segment.getField(3);
  const mainCoding = getCoding(codedConditionField, 0);
  const secondaryCoding = getCoding(codedConditionField, 1);

  const coding = [mainCoding, secondaryCoding].flatMap(c => c ?? []);
  if (coding.length < 1) return undefined;

  // TODO 2883: See if we can parse (or infer) onsetDateTime and other fields (so far looks like a no)
  const condition = buildCondition({ params: { code: { coding } }, patientId, encounterId });
  const diagnosisReference = buildConditionReference({ resource: condition });

  return {
    reasonCode: [{ coding }],
    condition,
    diagnosis: [diagnosisReference],
  };
}

function getConditionFromDg1Segment(
  dg1: Hl7Segment,
  patientId: string,
  encounterId: string
): Condition | undefined {
  const diagnosisCodingField = dg1.getField(3);
  const mainCoding = getCoding(diagnosisCodingField, 0);
  const secondaryCoding = getCoding(diagnosisCodingField, 1);

  const coding = [mainCoding, secondaryCoding].flatMap(c => c ?? []);
  if (coding.length < 1) return;

  return buildCondition({ params: { code: { coding } }, patientId, encounterId });
}

export function buildCondition({
  params,
  patientId,
  encounterId,
}: {
  params: ConditionWithCode;
  patientId: string;
  encounterId: string;
}): ConditionWithId {
  const { id, code, ...rest } = params;

  return {
    id: id ?? createUuidFromText(`${encounterId}-${JSON.stringify(code)}`),
    resourceType: "Condition",
    code,
    subject: buildPatientReference(patientId),
    ...rest,
  };
}
