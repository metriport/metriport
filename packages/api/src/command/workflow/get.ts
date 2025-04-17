import { NotFoundError } from "@metriport/shared";
import { Workflow } from "@metriport/shared/domain/workflow/types";
import { WorkflowModel } from "../../models/workflow";

export type WorkflowLookUpParams = Pick<
  Workflow,
  "cxId" | "patientId" | "facilityId" | "workflowId" | "requestId"
>;

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
