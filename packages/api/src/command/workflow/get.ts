import { NotFoundError, Workflow, WorkflowStatus } from "@metriport/shared";
import { WorkflowModel } from "../../models/workflow";

export type WorkflowLookUpParams = Pick<Workflow, "cxId" | "workflowId" | "requestId"> &
  Partial<Pick<Workflow, "patientId" | "facilityId">>;

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
    where: {
      cxId,
      ...(patientId ? { patientId } : {}),
      ...(facilityId ? { facilityId } : {}),
      workflowId,
      requestId,
    },
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

export async function getLatestWorkflow({
  cxId,
  patientId,
  facilityId,
  workflowId,
  status,
}: Omit<WorkflowLookUpParams, "requestId"> & { status?: WorkflowStatus }): Promise<
  Workflow | undefined
> {
  const workflows = await WorkflowModel.findAll({
    where: {
      cxId,
      ...(patientId ? { patientId } : {}),
      ...(facilityId ? { facilityId } : {}),
      workflowId,
      ...(status ? { status } : {}),
    },
    order: [["createdAt", "DESC"]],
  });
  if (workflows.length < 1) return undefined;
  return workflows[0].dataValues;
}
