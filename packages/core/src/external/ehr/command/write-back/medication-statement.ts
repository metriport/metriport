import { Medication, MedicationStatement } from "@medplum/fhirtypes";
import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackMedicationStatement as writeBackMedicationStatementAthena } from "../../athenahealth/command/write-back/medication-statement";

export type WriteBackMedicationStatementRequest = {
  ehr: EhrSource;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  medication: Medication;
  statements: MedicationStatement[];
};

export type WriteBackMedicationStatementClientRequest = Omit<
  WriteBackMedicationStatementRequest,
  "ehr"
>;

export async function writeBackMedicationStatement({
  ehr,
  ...params
}: WriteBackMedicationStatementRequest): Promise<void> {
  const handler = getEhrWriteBackMedicationStatementHandler(ehr);
  return await handler({ ...params });
}

type WriteBackMedicationStatementFn = (
  params: WriteBackMedicationStatementClientRequest
) => Promise<void>;

type WriteBackMedicationStatementFnMap = Record<
  EhrSource,
  WriteBackMedicationStatementFn | undefined
>;

const ehrWriteBackMedicationStatementMap: WriteBackMedicationStatementFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: writeBackMedicationStatementAthena,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
  [EhrSources.salesforce]: undefined,
  [EhrSources.epic]: undefined,
};

function getEhrWriteBackMedicationStatementHandler(ehr: EhrSource): WriteBackMedicationStatementFn {
  const handler = ehrWriteBackMedicationStatementMap[ehr];
  if (!handler) {
    throw new BadRequestError(
      "Could not find handler to write back medication statement",
      undefined,
      {
        ehr,
      }
    );
  }
  return handler;
}
