import { Hl7Message } from "@medplum/core";
import { CodeableConcept, Coding, Condition, EncounterDiagnosis } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import {
  buildConditionReference,
  buildPatientReference,
} from "../../../../external/fhir/shared/references";
import {
  getOptionalValueFromSegment,
  getSegmentByNameOrFail,
  mapAdtSystemNameToSystemUrl,
} from "../shared";

type ConditionWithId = Condition & {
  id: string;
};

type AdmitReason = {
  reasonCode: CodeableConcept[];
  condition: Condition;
  diagnosis: EncounterDiagnosis[];
};

type ConditionWithCode = Partial<Condition> & {
  code: CodeableConcept;
};

// TODO 2883: see if Transfer Reason (PVE2.4) can be used to complement admit reason
export function getAdmitReasonFromPatientVisitAddon(
  adt: Hl7Message,
  patientId: string
): AdmitReason | undefined {
  const pv2Segment = getSegmentByNameOrFail(adt, "PV2");
  if (pv2Segment.fields.length === 0) return undefined;

  const reasonCode = getOptionalValueFromSegment(pv2Segment, 3, 1);
  const reasonDisplay = getOptionalValueFromSegment(pv2Segment, 3, 2);
  const reasonSystem = getOptionalValueFromSegment(pv2Segment, 3, 3);
  const system = mapAdtSystemNameToSystemUrl(reasonSystem);

  const mainCode = buildConditionCoding({
    code: reasonCode,
    display: reasonDisplay,
    system,
  });

  const secondaryReasonCode = getOptionalValueFromSegment(pv2Segment, 3, 4);
  const secondaryReasonDisplay = getOptionalValueFromSegment(pv2Segment, 3, 5);
  const secondaryReasonSystem = getOptionalValueFromSegment(pv2Segment, 3, 6);
  const secondarySystem = mapAdtSystemNameToSystemUrl(secondaryReasonSystem);

  const secondaryCode = buildConditionCoding({
    code: secondaryReasonCode,
    display: secondaryReasonDisplay,
    system: secondarySystem,
  });

  if (!mainCode && !secondaryCode) return undefined;
  const codings = [mainCode, secondaryCode].flatMap(c => c || []);

  // TODO 2883: See if we can parse (or infer) onsetDateTime and other fields
  const condition = buildCondition({ code: { coding: codings } }, patientId);
  const diagnosisReference = buildConditionReference({ resource: condition });

  return {
    reasonCode: [{ coding: codings }],
    condition,
    diagnosis: [diagnosisReference],
  };
}

function buildConditionCoding({
  code,
  display,
  system,
}: {
  code?: string | undefined;
  display?: string | undefined;
  system?: string | undefined;
}): Coding | undefined {
  if (!code && !display) return undefined;

  return {
    ...(code ? { code } : undefined),
    ...(display ? { display } : undefined),
    ...(system ? { system } : undefined),
  };
}

export function buildCondition(params: ConditionWithCode, patientId: string): ConditionWithId {
  const { id, code, ...remainingParams } = params;

  const deterministicID = createUuidFromText(JSON.stringify(code));
  return {
    id: id ?? deterministicID,
    resourceType: "Condition",
    code,
    subject: buildPatientReference(patientId),
    ...remainingParams,
  };
}
