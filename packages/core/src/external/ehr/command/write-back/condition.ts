import { Condition } from "@medplum/fhirtypes";
import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { ICD_10_CODE, SNOMED_CODE } from "@metriport/shared/medical/fhir/constants";
import { writeBackCondition as writeBackConditionAthena } from "../../athenahealth/command/write-back/condition";
import { writeBackCondition as writeBackConditionElation } from "../../elation/command/write-back/condition";

export type WriteBackConditionRequest = {
  ehr: EhrSource;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  condition: Condition;
};

export type WriteBackConditionClientRequest = Omit<WriteBackConditionRequest, "ehr">;

export async function writeBackCondition({
  ehr,
  ...params
}: WriteBackConditionRequest): Promise<void> {
  const handler = getEhrWriteBackConditionHandler(ehr);
  return await handler({ ...params });
}

type WriteBackConditionFn = (params: WriteBackConditionClientRequest) => Promise<void>;

type WriteBackConditionFnMap = Record<EhrSource, WriteBackConditionFn | undefined>;

const ehrWriteBackConditionMap: WriteBackConditionFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: writeBackConditionAthena,
  [EhrSources.elation]: writeBackConditionElation,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrWriteBackConditionHandler(ehr: EhrSource): WriteBackConditionFn {
  const handler = ehrWriteBackConditionMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to write back condition", undefined, {
      ehr,
    });
  }
  return handler;
}

type CodingSystem = typeof SNOMED_CODE | typeof ICD_10_CODE;

export const ehrWriteBackConditionPrimaryCodeMap: Record<EhrSource, CodingSystem | undefined> = {
  [EhrSources.elation]: SNOMED_CODE,
  [EhrSources.athena]: SNOMED_CODE,
  [EhrSources.canvas]: ICD_10_CODE,
  [EhrSources.healthie]: ICD_10_CODE,
  [EhrSources.eclinicalworks]: undefined,
};

export function getEhrWriteBackConditionPrimaryCode(ehr: EhrSource): CodingSystem {
  const system = ehrWriteBackConditionPrimaryCodeMap[ehr];
  if (!system) {
    throw new BadRequestError("Could not find code system to write back condition", undefined, {
      ehr,
    });
  }
  return system;
}
