import { out } from "@metriport/core/util/log";
import {
  getPatientByDemo,
  getPatientOrFail,
  PatientWithIdentifiers,
} from "../../../../../command/medical/patient/get-patient";
import { handleMetriportSync, HandleMetriportSyncParams } from "../../utils/patient";
import { confirmEhrPatientDemographicsMatchMetriport } from "./confirm-patient-match";

export async function getOrCreateMetriportPatient({
  source,
  cxId,
  practiceId,
  demographics,
  externalId,
  inputMetriportPatientId,
}: HandleMetriportSyncParams & {
  inputMetriportPatientId?: string;
}): Promise<PatientWithIdentifiers> {
  const { log } = out(
    `getOrCreateMetriportPatient - source: ${source} practId: ${practiceId} ptId: ${externalId}`
  );
  if (inputMetriportPatientId) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: inputMetriportPatientId,
    });
    log(`for metriport id: ${inputMetriportPatientId}, confirming patient match`);
    await confirmEhrPatientDemographicsMatchMetriport({
      cxId,
      patientId: metriportPatient.id,
      demographics,
    });
    log(`patient match confirmed successfully`);
    return metriportPatient;
  }
  const metriportPatient = await getPatientByDemo({ cxId, demo: demographics });
  if (metriportPatient) {
    log(`patient found by demo: ${metriportPatient.id}`);
    return metriportPatient;
  }
  log(`no patient found by demo, creating new patient`);
  return await handleMetriportSync({
    cxId,
    source,
    practiceId,
    demographics,
    externalId,
  });
}
