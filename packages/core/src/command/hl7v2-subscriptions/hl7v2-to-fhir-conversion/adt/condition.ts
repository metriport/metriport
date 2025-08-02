import { Hl7Message, Hl7Segment } from "@medplum/core";
import { CodeableConcept, Coding, Condition, EncounterDiagnosis } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import {
  buildConditionReference,
  buildPatientReference,
} from "../../../../external/fhir/shared/references";
import { deduplicateConditions } from "../../../../fhir-deduplication/resources/condition";
import { getCoding } from "./utils";
import _, { compact } from "lodash";

type ConditionWithId = Condition & {
  id: string;
};

type ConditionsAndReferences = {
  conditions: Condition[];
  refs: EncounterDiagnosis[];
};

type ConditionWithCode = Partial<Condition> & {
  code: CodeableConcept;
};

function isDisplayOnly(c: Coding) {
  return c.display !== undefined && c.code === undefined && c.system === undefined;
}

/**
 * It's common to receive the encounter reason coding in a DG1 section as well.
 * This removes the common noisy offenders that are not actual diagnoses.
 * @param conditions Diagnoses
 * @param encounterReasonCodings Encounter reason codings
 * @returns Diagnoses without display only codings that originated from the encounter reason
 */
function withoutEncounterReasonCodings(conditions: Condition[], encounterReasonCodings: Coding[]) {
  const reasonCodings = encounterReasonCodings.filter(isDisplayOnly);
  return compact(
    conditions.map(d => {
      const diagnosisCodings = d.code?.coding;
      if (diagnosisCodings === undefined) return;
      const withoutEncounterReason = _.differenceWith(diagnosisCodings, reasonCodings, _.isEqual);

      return { ...d, code: { ...d.code, coding: withoutEncounterReason } };
    })
  );
}

export function getConditionsAndReferences(
  adt: Hl7Message,
  patientId: string
): ConditionsAndReferences {
  let diagnoses = getAllDiagnoses(adt, patientId);
  const encounterReasonCodings = getEncounterReasonCodings(adt);
  if (encounterReasonCodings !== undefined) {
    diagnoses = withoutEncounterReasonCodings(diagnoses, encounterReasonCodings);
  }

  const uniqueConditions = deduplicateConditions(diagnoses, false).combinedResources;
  const conditionReferences = uniqueConditions.map(condition =>
    buildConditionReference({ resource: condition })
  );

  return {
    conditions: uniqueConditions,
    refs: conditionReferences,
  };
}

export function getEncounterReasonCodings(adt: Hl7Message): Coding[] | undefined {
  const pv2Segment = adt.getSegment("PV2");
  if (!pv2Segment || pv2Segment.fields.length < 1) return undefined;

  const codedConditionField = pv2Segment.getField(3);
  const mainCoding = getCoding(codedConditionField, 0);
  const secondaryCoding = getCoding(codedConditionField, 1);

  const coding = [mainCoding, secondaryCoding].flatMap(c => c ?? []);
  if (coding.length < 1) return undefined;

  return coding;
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
