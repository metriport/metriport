import { getPatient as getAthenaPatient } from "@metriport/core/external/athenahealth/get-patient";
import { getPatient as getMetriportPatient } from "../../../command/medical/patient/get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { Config } from "../../../shared/config";

const athenaUrl = Config.getAthenaHealthUrl();

export async function getPatient({
  accessToken,
  cxId,
  patientId,
}: {
  accessToken: string;
  cxId: string;
  patientId: string;
}): Promise<PatientModel | undefined> {
  if (!athenaUrl) throw new Error("Athenahealth url not defined");
  await getAthenaPatient({
    accessToken,
    baseUrl: athenaUrl,
    patientId,
  });
  return await getMetriportPatient({ cxId, id: "test" });
}
