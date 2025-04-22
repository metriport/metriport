import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  MetriportError,
  Workflow,
  WorkflowData,
  workflowInitialStatus,
  WorkflowParamsCx,
  WorkflowParamsOps,
} from "@metriport/shared";
import { WorkflowModel } from "../../models/workflow";
import { getLatestWorkflow } from "./get";

export type WorkflowParams = Omit<
  Workflow,
  | "id"
  | "patientId"
  | "facilityId"
  | "status"
  | "startedAt"
  | "finishedAt"
  | "reason"
  | "total"
  | "successful"
  | "failed"
  | "paramsCx"
  | "paramsOps"
  | "data"
> & {
  patientId?: string;
  facilityId?: string;
  paramsCx?: WorkflowParamsCx;
  paramsOps?: WorkflowParamsOps;
  data?: WorkflowData;
  limitedToOneRunningWorkflow?: boolean;
};

export async function createWorkflow({
  cxId,
  patientId,
  facilityId,
  workflowId,
  requestId,
  paramsCx,
  paramsOps,
  data,
  limitedToOneRunningWorkflow = false,
}: WorkflowParams): Promise<Workflow> {
  if (limitedToOneRunningWorkflow) {
    const runningWorkflow = await getLatestWorkflow({
      cxId,
      patientId,
      facilityId,
      workflowId,
      status: ["processing", "waiting"],
    });
    if (runningWorkflow) {
      throw new MetriportError("Only one workflow can be running at a time", undefined, {
        cxId,
        patientId,
        facilityId,
        workflowId,
        runningWorkflowId: runningWorkflow.id,
      });
    }
  }
  const created = await WorkflowModel.create({
    id: uuidv7(),
    cxId,
    patientId,
    facilityId,
    workflowId,
    requestId,
    status: workflowInitialStatus,
    total: 0,
    successful: 0,
    failed: 0,
    paramsCx,
    paramsOps,
    data,
  });
  return created.dataValues;
}
