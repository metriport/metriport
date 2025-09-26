import { Procedure } from "@medplum/fhirtypes";
import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackProcedure as writeBackProcedureAthena } from "../../athenahealth/command/write-back/procedure";

export type WriteBackProcedureRequest = {
  ehr: EhrSource;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  procedure: Procedure;
};

export type WriteBackProcedureClientRequest = Omit<WriteBackProcedureRequest, "ehr">;

export async function writeBackProcedure({
  ehr,
  ...params
}: WriteBackProcedureRequest): Promise<void> {
  const handler = getEhrWriteBackProcedureHandler(ehr);
  return await handler({ ...params });
}

type WriteBackProcedureFn = (params: WriteBackProcedureClientRequest) => Promise<void>;

type WriteBackProcedureFnMap = Record<EhrSource, WriteBackProcedureFn | undefined>;

const ehrWriteBackProcedureMap: WriteBackProcedureFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: writeBackProcedureAthena,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
  [EhrSources.salesforce]: undefined,
  [EhrSources.epic]: undefined,
};

function getEhrWriteBackProcedureHandler(ehr: EhrSource): WriteBackProcedureFn {
  const handler = ehrWriteBackProcedureMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to write back procedure", undefined, {
      ehr,
    });
  }
  return handler;
}
