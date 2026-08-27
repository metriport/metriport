import { out } from "@metriport/core/util/log";
import { EmbedSources } from "@metriport/shared/interface/external/ehr/source";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";

export type SyncEmbedPatientIntoMetriportParams = {
  cxId: string;
  embedPracticeId: string;
  embedPatientId: string;
};

export async function syncEmbedPatientIntoMetriport({
  cxId,
  embedPracticeId,
  embedPatientId, // Unlike other EHRs, embedPatientId is a metriportPatientId
}: SyncEmbedPatientIntoMetriportParams): Promise<string> {
  const { log } = out(
    `syncEmbedPatientIntoMetriport - practiceId: ${embedPracticeId} ptId: ${embedPatientId}`
  );
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: embedPatientId,
    source: EmbedSources.embed,
  });
  if (existingPatient) {
    log("existing patient mapping found", existingPatient.patientId);
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }
  log("no existing mapping found, creating new patient mapping");
  await getPatientOrFail({ id: embedPatientId, cxId });
  await findOrCreatePatientMapping({
    cxId,
    patientId: embedPatientId,
    externalId: embedPatientId,
    source: EmbedSources.embed,
    secondaryMappings: { practiceId: embedPracticeId },
  });
  return embedPatientId;
}
