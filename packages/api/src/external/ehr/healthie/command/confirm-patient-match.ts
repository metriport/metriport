import { PatientDemoData } from "@metriport/core/domain/patient";
import { getPatientByDemo } from "../../../../command/medical/patient/get-patient";
import { MetriportError } from "@metriport/core/util/error/metriport-error";

export async function confirmPatientMatch({
  cxId,
  patientId,
  demographics,
}: {
  cxId: string;
  patientId: string;
  demographics: PatientDemoData;
}): Promise<void> {
  const patientExists = await getPatientByDemo({ cxId, demo: demographics });
  if (!patientExists) {
    throw new MetriportError("Patient does not exist", undefined, {
      cxId,
      patientId,
      demographics: JSON.stringify(demographics),
    });
  }

  if (patientExists.id !== patientId) {
    throw new MetriportError("Patient does not match", undefined, {
      cxId,
      patientId,
      demographics: JSON.stringify(demographics),
      message: "Please make sure you are linking the correct patient",
    });
  }
}
