import { AllergyIntolerance } from "@medplum/fhirtypes";
import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackAllergy as writeBackAllergyAthena } from "../../athenahealth/command/write-back/allergy";

export type WriteBackAllergyRequest = {
  ehr: EhrSource;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  allergyIntolerance: AllergyIntolerance;
};

export type WriteBackAllergyClientRequest = Omit<WriteBackAllergyRequest, "ehr">;

export async function writeBackAllergy({ ehr, ...params }: WriteBackAllergyRequest): Promise<void> {
  const handler = getEhrWriteBackAllergyHandler(ehr);
  return await handler({ ...params });
}

type WriteBackAllergyFn = (params: WriteBackAllergyClientRequest) => Promise<void>;

type WriteBackAllergyFnMap = Record<EhrSource, WriteBackAllergyFn | undefined>;

const ehrWriteBackAllergyMap: WriteBackAllergyFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: writeBackAllergyAthena,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
  [EhrSources.salesforce]: undefined,
};

function getEhrWriteBackAllergyHandler(ehr: EhrSource): WriteBackAllergyFn {
  const handler = ehrWriteBackAllergyMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to write back allergy", undefined, {
      ehr,
    });
  }
  return handler;
}
