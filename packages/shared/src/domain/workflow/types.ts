import { WorkflowStatus } from "./workflow-status";

export type WorkflowParamsCx = Record<string, string | boolean>;
export type WorkflowParamsOps = Record<string, string | boolean>;
export type WorkflowData = Record<string, unknown>;

// TODO 2330 move BaseDomain to packages/shared and extend from it here
export type Workflow = {
  id: string;
  cxId: string;
  facilityId: string | undefined;
  patientId: string | undefined;
  workflowId: string;
  requestId: string;
  status: WorkflowStatus;
  reason: string | undefined;
  startedAt: Date | undefined;
  finishedAt: Date | undefined;
  total: number;
  successful: number;
  failed: number;
  paramsCx: WorkflowParamsCx | undefined;
  paramsOps: WorkflowParamsOps | undefined;
  data: WorkflowData | undefined;
};

const failed = "failed" as const;
const successful = "successful" as const;

export type WorkflowEntryStatusFailed = typeof failed;
export type WorkflowEntryStatusParsed = "waiting" | "processing" | typeof successful;
export type WorkflowEntryStatus = WorkflowEntryStatusFailed | WorkflowEntryStatusParsed;
export type WorkflowEntryStatusFinal = typeof failed | typeof successful;

export function isValidEntryStatus(status: string): status is WorkflowEntryStatus {
  return (
    status === "waiting" ||
    status === "processing" ||
    status === "successful" ||
    status === "failed"
  );
}
