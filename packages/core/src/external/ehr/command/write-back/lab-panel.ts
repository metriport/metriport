import { DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackLabPanel as writeBackLabPanelElation } from "../../elation/command/write-back/lab-panel";

export type WriteBackLabPanelRequest = {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  diagnostricReport: DiagnosticReport;
  observations: Observation[];
};

export type WriteBackLabPanelClientRequest = Omit<WriteBackLabPanelRequest, "ehr">;

export async function writeBackLabPanel({
  ehr,
  ...params
}: WriteBackLabPanelRequest): Promise<void> {
  const handler = getEhrWriteBackLabPanelHandler(ehr);
  return await handler({ ...params });
}

type WriteBackLabPanelFn = (params: WriteBackLabPanelClientRequest) => Promise<void>;

type WriteBackLabPanelFnMap = Record<EhrSource, WriteBackLabPanelFn | undefined>;

const ehrWriteBackLabPanelMap: WriteBackLabPanelFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: undefined,
  [EhrSources.elation]: writeBackLabPanelElation,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrWriteBackLabPanelHandler(ehr: EhrSource): WriteBackLabPanelFn {
  const handler = ehrWriteBackLabPanelMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to write back lab panel", undefined, {
      ehr,
    });
  }
  return handler;
}
