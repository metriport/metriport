import { buildDayjs } from "@metriport/shared/common/date";
import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, Status } from "../types";
import { CreatePatientStateDrParams } from "./types";

export type CreatePatientStateDrCmd = Omit<CreatePatientStateDrParams, "params"> & {
  params: Omit<
    CreatePatientStateDrParams["params"],
    "status" | "startedAt" | "countSuccess" | "countError"
  >;
};

export async function createPatientStateDr(params: CreatePatientStateDrCmd): Promise<PatientState> {
  const { patientId, cxId, network, params: drParams } = params;
  const { requestId, facilityId, countTotal, countFilteredFromRedownload, forceDownload } =
    drParams;

  const status = calculateInitialStatus(countTotal, countFilteredFromRedownload);
  return await createOrUpdatePatientState({
    cxId,
    patientId,
    network,
    requestId,
    state: {
      dr: {
        status,
        startedAt: buildDayjs().toISOString(),
        requestId,
        facilityId,
        countSuccess: 0,
        countError: 0,
        countTotal,
        countFilteredFromRedownload,
        forceDownload,
      },
    },
  });
}

function calculateInitialStatus(countTotal: number, countFilteredFromRedownload: number): Status {
  return countTotal - countFilteredFromRedownload <= 0 ? Status.completed : Status.processing;
}
