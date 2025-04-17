import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Workflow } from "@metriport/shared/domain/workflow/types";
import { WorkflowModel } from "../../models/workflow";

export type WorkflowParams = Workflow;

export type WorkflowLookUpParams = Pick<
  WorkflowParams,
  "cxId" | "patientId" | "facilityId" | "workflowId" | "requestId"
>;

export async function createWorkflow({
  cxId,
  patientId,
  facilityId,
  workflowId,
  requestId,
  status,
  reason,
  startedAt,
  finishedAt,
  total,
  successful,
  failed,
  paramsCx,
  paramsOps,
  data,
}: WorkflowParams): Promise<Workflow> {
  const created = await WorkflowModel.create({
    id: uuidv7(),
    cxId,
    patientId,
    facilityId,
    workflowId,
    requestId,
    status,
    reason,
    startedAt,
    finishedAt,
    total,
    successful,
    failed,
    paramsCx,
    paramsOps,
    data,
  });
  return created.dataValues;
}
