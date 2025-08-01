import { PatientDemoData } from "@metriport/core/domain/patient";
import { BadRequestError } from "@metriport/shared";
import { getPatientByDemo } from "../../../../../command/medical/patient/get-patient";

export async function confirmEhrPatientDemographicsMatchMetriport({
  cxId,
  patientId,
  demographics,
}: {
  cxId: string;
  patientId: string;
  demographics: PatientDemoData;
}): Promise<void> {
  const patientExists = await getPatientByDemo({ cxId, demo: demographics });
  if (!patientExists || patientExists.id !== patientId) {
    throw new BadRequestError(
      "Patient demographics do not match the provided Metriport patient ID",
      undefined,
      {
        cxId,
        patientId,
        demographics: JSON.stringify(demographics),
        message: "Please make sure you are linking the correct patient",
      }
    );
  }
}
