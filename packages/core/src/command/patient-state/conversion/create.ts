import { buildDayjs } from "@metriport/shared/common/date";
import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, Status } from "../types";
import { CreatePatientStateConversionParams } from "./types";

export type CreatePatientStateConversionCmd = Omit<CreatePatientStateConversionParams, "params"> & {
  params: Omit<
    CreatePatientStateConversionParams["params"],
    "status" | "startedAt" | "totalConverted" | "totalErrors"
  >;
};

export async function createPatientStateConversion(
  params: CreatePatientStateConversionCmd
): Promise<PatientState> {
  const { patientId, cxId, network, params: conversionParams } = params;
  const { requestId, totalToConvert } = conversionParams;

  // Short-circuit: if there are no documents to convert, complete immediately
  if (totalToConvert === 0) {
    return await createOrUpdatePatientState({
      cxId,
      patientId,
      network,
      requestId,
      state: {
        conversion: {
          status: Status.completed,
          startedAt: buildDayjs().toISOString(),
          requestId,
          totalToConvert: 0,
          totalConverted: 0,
          totalErrors: 0,
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
      conversion: {
        status: Status.processing,
        startedAt: buildDayjs().toISOString(),
        requestId,
        totalToConvert,
        totalConverted: 0,
        totalErrors: 0,
      },
    },
  });
}
