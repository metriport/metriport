import { Condition } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackCondition as writeBackConditionElation } from "../../elation/command/write-back/condition";

export type WriteBackConditionRequest = {
  ehr: EhrSource;
  tokenId?: string;
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
  [EhrSources.athena]: undefined,
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
