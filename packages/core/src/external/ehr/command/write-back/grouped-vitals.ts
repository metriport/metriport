import { Observation } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackGroupedVitals as writeBackGroupedVitalsElation } from "../../elation/command/write-back/grouped-vitals";

export type WriteBackGroupedVitalsRequest = {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  observations: Observation[];
};

export type WriteBackGroupedVitalsClientRequest = Omit<WriteBackGroupedVitalsRequest, "ehr">;

export async function writeBackGroupedVitals({
  ehr,
  ...params
}: WriteBackGroupedVitalsRequest): Promise<void> {
  const handler = getEhrWriteBackGroupedVitalsHandler(ehr);
  return await handler({ ...params });
}

type WriteBackGroupedVitalsFn = (params: WriteBackGroupedVitalsClientRequest) => Promise<void>;

type WriteBackGroupedVitalsFnMap = Record<EhrSource, WriteBackGroupedVitalsFn | undefined>;

const ehrWriteBackGroupedVitalsMap: WriteBackGroupedVitalsFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: undefined,
  [EhrSources.elation]: writeBackGroupedVitalsElation,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrWriteBackGroupedVitalsHandler(ehr: EhrSource): WriteBackGroupedVitalsFn {
  const handler = ehrWriteBackGroupedVitalsMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to write back vital", undefined, {
      ehr,
    });
  }
  return handler;
}

export const writeBackGroupedVitalsEhrs = [EhrSources.elation];
export function isWriteBackGroupedVitalsEhr(ehr: EhrSource): boolean {
  return writeBackGroupedVitalsEhrs.includes(ehr);
}
