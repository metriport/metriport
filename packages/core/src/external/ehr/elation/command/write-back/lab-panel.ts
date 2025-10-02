import { WriteBackLabPanelClientRequest } from "../../../command/write-back/lab-panel";
import { createElationHealthClient } from "../../shared";
import { getDefaultPracticeAndPhysicianIds } from "../get-default-practice-and-physician-ids";

export async function writeBackLabPanel(params: WriteBackLabPanelClientRequest): Promise<void> {
  const { tokenInfo, cxId, practiceId, ehrPatientId, diagnosticReport, observations } = params;
  const { elationPracticeId, elationPhysicianId } = await getDefaultPracticeAndPhysicianIds({
    practiceId,
  });
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  await client.createLabPanel({
    cxId,
    elationPracticeId,
    elationPhysicianId,
    patientId: ehrPatientId,
    diagnosticReport,
    observations,
  });
}
