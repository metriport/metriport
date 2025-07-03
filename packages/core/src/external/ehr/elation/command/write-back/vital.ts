import { WriteBackVitalClientRequest } from "../../../command/write-back/vital";
import { createElationHealthClient } from "../../shared";

export async function writeBackVital(params: WriteBackVitalClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenId, observation } = params;
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  await client.createVital({ cxId, patientId: ehrPatientId, observation });
}
