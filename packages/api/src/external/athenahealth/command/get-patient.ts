import { getPatient as getAthenaPatient } from "@metriport/core/external/athenahealth/get-patient";
import { getPatient as getMetriportPatient } from "../../../command/medical/patient/get-patient";
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
}) {
  if (!athenaUrl) throw new Error("Athenahealth url not defined");
  await getAthenaPatient({
    accessToken,
    baseUrl: athenaUrl,
    patientId,
  });

  await getMetriportPatient({ cxId, id: "test" });
}
