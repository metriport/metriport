import { WriteBackAllergyClientRequest } from "../../../command/write-back/allergy";
import { createHealthieClient } from "../../shared";

export async function writeBackAllergyHealthie(
  params: WriteBackAllergyClientRequest
): Promise<void> {
  const { cxId, practiceId, ehrPatientId, allergyIntolerance } = params;
  const client = await createHealthieClient({
    cxId,
    practiceId,
  });
  await client.createAllergyIntolerance({
    cxId,
    patientId: ehrPatientId,
    allergyIntolerance,
  });
}
