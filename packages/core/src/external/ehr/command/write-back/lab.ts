import { Observation } from "@medplum/fhirtypes";
import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackLab as writeBackLabAthena } from "../../athenahealth/command/write-back/lab";
import { writeBackLab as writeBackLabElation } from "../../elation/command/write-back/lab";

export type WriteBackLabRequest = {
  ehr: EhrSource;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  observation: Observation;
};

export type WriteBackLabClientRequest = Omit<WriteBackLabRequest, "ehr">;

export async function writeBackLab({ ehr, ...params }: WriteBackLabRequest): Promise<void> {
  const handler = getEhrWriteBackLabHandler(ehr);
  return await handler({ ...params });
}

type WriteBackLabFn = (params: WriteBackLabClientRequest) => Promise<void>;

type WriteBackLabFnMap = Record<EhrSource, WriteBackLabFn | undefined>;

const ehrWriteBackLabMap: WriteBackLabFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: writeBackLabAthena,
  [EhrSources.elation]: writeBackLabElation,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
  [EhrSources.salesforce]: undefined,
};

function getEhrWriteBackLabHandler(ehr: EhrSource): WriteBackLabFn {
  const handler = ehrWriteBackLabMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to write back lab", undefined, {
      ehr,
    });
  }
  return handler;
}
