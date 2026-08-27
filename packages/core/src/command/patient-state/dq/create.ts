import { buildDayjs } from "@metriport/shared/common/date";
import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, Status } from "../types";
import { CreatePatientStateDqParams } from "./types";

export type CreatePatientStateDqCmd = Omit<CreatePatientStateDqParams, "params"> & {
  params: Omit<
    CreatePatientStateDqParams["params"],
    "status" | "startedAt" | "gatewaySuccess" | "gatewayFailure"
  >;
};

export async function createPatientStateDq(params: CreatePatientStateDqCmd): Promise<PatientState> {
  const { patientId, cxId, network, params: dqParams } = params;
  const { requestId, facilityId, totalGateways, totalDocuments, forceDownload } = dqParams;

  // Short-circuit: if there are no gateways, complete immediately
  if (totalGateways === 0) {
    return await createOrUpdatePatientState({
      cxId,
      patientId,
      network,
      requestId,
      state: {
        dq: {
          status: Status.completed,
          startedAt: buildDayjs().toISOString(),
          requestId,
          facilityId,
          totalGateways: 0,
          gatewaySuccess: 0,
          gatewayFailure: 0,
          totalDocuments: 0,
          forceDownload,
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
      dq: {
        status: Status.processing,
        startedAt: buildDayjs().toISOString(),
        requestId,
        facilityId,
        totalGateways,
        gatewaySuccess: 0,
        gatewayFailure: 0,
        totalDocuments,
        forceDownload,
      },
    },
  });
}
