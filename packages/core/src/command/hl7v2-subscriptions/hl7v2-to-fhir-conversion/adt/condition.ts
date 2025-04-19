import { Hl7Message } from "@medplum/core";
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

type AdmitReason = {
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
  const admitReason = getAdmitReason(adt, patientId);
  const diagnoses = getDiagnoses(adt, patientId);

  const combinedDiagnoses = _.concat(admitReason?.condition ?? [], diagnoses ?? []);
  const uniqueConditions = deduplicateConditions(combinedDiagnoses, false).combinedResources;
  const conditionReferences = uniqueConditions.map(condition =>
    buildConditionReference({ resource: condition })
  );

  return {
    reasonCode: admitReason?.reasonCode,
    conditions: uniqueConditions,
    refs: conditionReferences,
  };
}

export function getAdmitReason(adt: Hl7Message, patientId: string): AdmitReason | undefined {
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

export function getDiagnoses(adt: Hl7Message, patientId: string): Condition[] | undefined {
  const dg1Segments = adt.getAllSegments("DG1");
  if (!dg1Segments || dg1Segments.length < 1) return undefined;

  const conditions: ConditionWithId[] = [];

  for (const dg1Segment of dg1Segments) {
    const diagnosisCodingField = dg1Segment.getField(3);
    const mainCoding = getCoding(diagnosisCodingField, 0);
    const secondaryCoding = getCoding(diagnosisCodingField, 1);

    const coding = [mainCoding, secondaryCoding].flatMap(c => c ?? []);
    if (coding.length < 1) return undefined;

    const condition = buildCondition({ code: { coding } }, patientId);
    conditions.push(condition);
  }

  return conditions;
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
