import { WriteBackConditionClientRequest } from "../../../command/write-back/condition";
import { createElationHealthClient } from "../../shared";

export async function writeBackCondition(params: WriteBackConditionClientRequest): Promise<void> {
  const { tokenInfo, cxId, practiceId, ehrPatientId, condition } = params;
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  await client.createProblem({ cxId, patientId: ehrPatientId, condition });
}
