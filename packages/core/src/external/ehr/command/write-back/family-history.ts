import { FamilyMemberHistory } from "@medplum/fhirtypes";
import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackFamilyHistory as writeBackFamilyHistoryAthena } from "../../athenahealth/command/write-back/family-history";

export type WriteBackFamilyHistoryRequest = {
  ehr: EhrSource;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  familyHistory: FamilyMemberHistory;
};

export type WriteBackFamilyHistoryClientRequest = Omit<WriteBackFamilyHistoryRequest, "ehr">;

export async function writeBackFamilyHistory({
  ehr,
  ...params
}: WriteBackFamilyHistoryRequest): Promise<void> {
  const handler = getEhrWriteBackFamilyHistoryHandler(ehr);
  return await handler({ ...params });
}

type WriteBackFamilyHistoryFn = (params: WriteBackFamilyHistoryClientRequest) => Promise<void>;

type WriteBackFamilyHistoryFnMap = Record<EhrSource, WriteBackFamilyHistoryFn | undefined>;

const ehrWriteBackFamilyHistoryMap: WriteBackFamilyHistoryFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: writeBackFamilyHistoryAthena,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
  [EhrSources.salesforce]: undefined,
  [EhrSources.practicefusion]: undefined,
};

function getEhrWriteBackFamilyHistoryHandler(ehr: EhrSource): WriteBackFamilyHistoryFn {
  const handler = ehrWriteBackFamilyHistoryMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to write back family history", undefined, {
      ehr,
    });
  }
  return handler;
}
