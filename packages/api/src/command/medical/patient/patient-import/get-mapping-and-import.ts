import { out } from "@metriport/core/util/log";
import { MetriportError, NotFoundError } from "@metriport/shared";
import { PatientImportMapping } from "@metriport/shared/domain/patient/patient-import/mapping";
import { PatientImport } from "@metriport/shared/domain/patient/patient-import/types";
import { getPatientImportJobOrFail } from "./get";
import { getPatientImportMappings } from "./mapping/get";

/**
 * Gets the active patient import job and mapping for a patient's data pipeline request.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param requestId - The data pipelinerequest ID.
 * @returns the active/processing patient import job and mapping, undefined if can't find them.
 */
export async function getPatientImportByRequestId({
  cxId,
  patientId,
  requestId,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
}): Promise<{ mapping: PatientImportMapping; import: PatientImport } | undefined> {
  const { log } = out(
    `getPatientImportByRequestId - cxId ${cxId} patientId ${patientId} requestId ${requestId}`
  );

  const mappings = await getPatientImportMappings({ cxId, patientId, requestId });

  if (mappings.length < 1) {
    log(`No mapping found for patient`);
    return undefined;
  }

  if (mappings.length === 1) {
    const mapping = mappings[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    const id = mapping.id;
    const importJob = await getPatientImportJobOrFail({ cxId, id });
    return { mapping, import: importJob };
  }

  const mappingIds = mappings.map(m => m.jobId);
  throw new MetriportError(`Multiple patient import mappings found`, undefined, {
    cxId,
    patientId,
    requestId,
    mappingIds: mappingIds.join(", "),
  });
}

export async function getPatientImportByRequestIdOrFail({
  cxId,
  patientId,
  requestId,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
}): Promise<{ mapping: PatientImportMapping; import: PatientImport }> {
  const result = await getPatientImportByRequestId({ cxId, patientId, requestId });
  if (!result) {
    throw new NotFoundError(`Patient import not found @ PatientImport`, {
      cxId,
      patientId,
      requestId,
      context: "patient-import.getPatientImportByRequestIdOrFail",
    });
  }
  return result;
}
