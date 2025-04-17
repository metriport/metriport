import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  Workflow,
  WorkflowData,
  WorkflowParamsCx,
  WorkflowParamsOps,
} from "@metriport/shared/domain/workflow/types";
import { initialStatus } from "@metriport/shared/domain/workflow/workflow-status";
import { WorkflowModel } from "../../models/workflow";

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
}: WorkflowParams): Promise<Workflow> {
  const created = await WorkflowModel.create({
    id: uuidv7(),
    cxId,
    patientId,
    facilityId,
    workflowId,
    requestId,
    status: initialStatus,
    total: 0,
    successful: 0,
    failed: 0,
    paramsCx,
    paramsOps,
    data,
  });
  return created.dataValues;
}
