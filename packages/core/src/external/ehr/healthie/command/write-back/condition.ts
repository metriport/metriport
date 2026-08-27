import { WriteBackConditionClientRequest } from "../../../command/write-back/condition";
import { createHealthieClient } from "../../shared";

export async function writeBackConditionHealthie(
  params: WriteBackConditionClientRequest
): Promise<void> {
  const { cxId, practiceId, ehrPatientId, condition } = params;
  const client = await createHealthieClient({
    cxId,
    practiceId,
  });
  await client.createCondition({
    cxId,
    patientId: ehrPatientId,
    condition,
  });
}
