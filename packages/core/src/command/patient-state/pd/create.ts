import { buildDayjs } from "@metriport/shared/common/date";
import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, Status } from "../types";
import { CreatePatientStatePdParams } from "./types";

export type CreatePatientStatePdCmd = Omit<CreatePatientStatePdParams, "params"> & {
  params: Omit<
    CreatePatientStatePdParams["params"],
    "status" | "startedAt" | "gatewaySuccess" | "gatewayFailure"
  >;
};

export async function createPatientStatePd(params: CreatePatientStatePdCmd): Promise<PatientState> {
  const { patientId, cxId, network, params: pdParams } = params;
  const {
    requestId,
    facilityId,
    rerunPdOnNewDemographics,
    isForceNewPdRun,
    totalGateways,
    isTargetedQuery,
  } = pdParams;

  // Short-circuit: if there are no gateways, complete immediately
  if (totalGateways === 0) {
    return await createOrUpdatePatientState({
      cxId,
      patientId,
      network,
      requestId,
      state: {
        pd: {
          status: Status.completed,
          startedAt: buildDayjs().toISOString(),
          requestId,
          facilityId,
          rerunPdOnNewDemographics,
          isForceNewPdRun,
          totalGateways: 0,
          gatewaySuccess: 0,
          gatewayFailure: 0,
          isTargetedQuery,
        },
      },
    });
  }

  return await createOrUpdatePatientState({
    cxId,
    patientId,
    network,
    requestId,
    state: {
      pd: {
        status: Status.processing,
        startedAt: buildDayjs().toISOString(),
        requestId,
        facilityId,
        rerunPdOnNewDemographics,
        isForceNewPdRun,
        totalGateways,
        gatewaySuccess: 0,
        gatewayFailure: 0,
        isTargetedQuery,
      },
    },
  });
}
