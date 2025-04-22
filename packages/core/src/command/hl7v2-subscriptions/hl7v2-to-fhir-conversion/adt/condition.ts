import { Hl7Message, Hl7Segment } from "@medplum/core";
import { CodeableConcept, Condition, EncounterDiagnosis } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import _ from "lodash";
import {
  buildConditionReference,
  buildPatientReference,
} from "../../../../external/fhir/shared/references";
import { deduplicateConditions } from "../../../../fhir-deduplication/resources/condition";
import { getCoding } from "./utils";

type ConditionWithId = Condition & {
  id: string;
};

type ConditionsAndReferences = {
  reasonCode: CodeableConcept[] | undefined;
  conditions: Condition[];
  refs: EncounterDiagnosis[];
};

type EncounterReason = {
  reasonCode: CodeableConcept[];
  condition: Condition;
  diagnosis: EncounterDiagnosis[];
};

type ConditionWithCode = Partial<Condition> & {
  code: CodeableConcept;
};

export function getConditionsAndReferences(
  adt: Hl7Message,
  patientId: string
): ConditionsAndReferences {
  const encReason = getEncounterReason(adt, patientId);
  const diagnoses = getAllDiagnoses(adt, patientId);

  const combinedDiagnoses = _.concat(encReason?.condition ?? [], diagnoses);
  const uniqueConditions = deduplicateConditions(combinedDiagnoses, false).combinedResources;
  const conditionReferences = uniqueConditions.map(condition =>
    buildConditionReference({ resource: condition })
  );

  return {
    reasonCode: encReason?.reasonCode,
    conditions: uniqueConditions,
    refs: conditionReferences,
  };
}

export function getEncounterReason(
  adt: Hl7Message,
  patientId: string
): EncounterReason | undefined {
  const pv2Segment = adt.getSegment("PV2");
  if (!pv2Segment || pv2Segment.fields.length < 1) return undefined;

  const codedConditionField = pv2Segment.getField(3);
  const mainCoding = getCoding(codedConditionField, 0);
  const secondaryCoding = getCoding(codedConditionField, 1);

  const coding = [mainCoding, secondaryCoding].flatMap(c => c ?? []);
  if (coding.length < 1) return undefined;

  // TODO 2883: See if we can parse (or infer) onsetDateTime and other fields (so far looks like a no)
  const condition = buildCondition({ code: { coding } }, patientId);
  const diagnosisReference = buildConditionReference({ resource: condition });

  return {
    reasonCode: [{ coding }],
    condition,
    diagnosis: [diagnosisReference],
  };
}

export function getAllDiagnoses(adt: Hl7Message, patientId: string): Condition[] {
  const dg1Segments = adt.getAllSegments("DG1");
  return dg1Segments.flatMap(dg1 => getDiagnosisFromDg1Segment(dg1, patientId) ?? []);
}

function getDiagnosisFromDg1Segment(dg1: Hl7Segment, patientId: string): Condition | undefined {
  const diagnosisCodingField = dg1.getField(3);
  const mainCoding = getCoding(diagnosisCodingField, 0);
  const secondaryCoding = getCoding(diagnosisCodingField, 1);

  const coding = [mainCoding, secondaryCoding].flatMap(c => c ?? []);
  if (coding.length < 1) return;

  return buildCondition({ code: { coding } }, patientId);
}

export function buildCondition(params: ConditionWithCode, patientId: string): ConditionWithId {
  const { id, code, ...rest } = params;

  return {
    id: id ?? createUuidFromText(JSON.stringify(code)),
    resourceType: "Condition",
    code,
    subject: buildPatientReference(patientId),
    ...rest,
  };
}
