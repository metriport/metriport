import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
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

export async function getWorkflow({
  cxId,
  patientId,
  facilityId,
  workflowId,
  requestId,
}: WorkflowLookUpParams): Promise<Workflow | undefined> {
  const existing = await getWorkflowModel({
    cxId,
    patientId,
    facilityId,
    workflowId,
    requestId,
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getWorkflowOrFail({
  cxId,
  patientId,
  facilityId,
  workflowId,
  requestId,
}: WorkflowLookUpParams): Promise<Workflow> {
  const workflow = await getWorkflowModel({
    cxId,
    patientId,
    facilityId,
    workflowId,
    requestId,
  });
  if (!workflow) {
    throw new NotFoundError("Workflow not found", undefined, {
      cxId,
      patientId,
      facilityId,
      workflowId,
      requestId,
    });
  }
  return workflow.dataValues;
}

export async function getWorkflowModel({
  cxId,
  patientId,
  facilityId,
  workflowId,
  requestId,
}: WorkflowLookUpParams): Promise<WorkflowModel | undefined> {
  const existing = await WorkflowModel.findOne({
    where: { cxId, patientId, facilityId, workflowId, requestId },
  });
  if (!existing) return undefined;
  return existing;
}

export async function getWorkflowModelOrFail({
  cxId,
  patientId,
  facilityId,
  workflowId,
  requestId,
}: WorkflowLookUpParams): Promise<WorkflowModel> {
  const workflow = await getWorkflowModel({
    cxId,
    patientId,
    facilityId,
    workflowId,
    requestId,
  });
  if (!workflow) {
    throw new NotFoundError("Workflow not found", undefined, {
      cxId,
      patientId,
      facilityId,
      workflowId,
      requestId,
    });
  }
  return workflow;
}
