import { Observation } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackVital as writeBackVitalElation } from "../../elation/command/write-back/vital";

export type WriteBackVitalRequest = {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  observation: Observation;
};

export type WriteBackVitalClientRequest = Omit<WriteBackVitalRequest, "ehr">;

export async function writeBackVital({ ehr, ...params }: WriteBackVitalRequest): Promise<void> {
  const handler = getEhrWriteBackVitalHandler(ehr);
  return await handler({ ...params });
}

type WriteBackVitalFn = (params: WriteBackVitalClientRequest) => Promise<void>;

type WriteBackVitalFnMap = Record<EhrSource, WriteBackVitalFn | undefined>;

const ehrWriteBackVitalMap: WriteBackVitalFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: undefined,
  [EhrSources.elation]: writeBackVitalElation,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrWriteBackVitalHandler(ehr: EhrSource): WriteBackVitalFn {
  const handler = ehrWriteBackVitalMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to write back vital", undefined, {
      ehr,
    });
  }
  return handler;
}
