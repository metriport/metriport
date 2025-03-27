import { PatientImportParamsCx, PatientImportParamsOps } from "../types";

export function makeParamsCx(params: Partial<PatientImportParamsCx> = {}): PatientImportParamsCx {
  return {
    dryRun: false,
    ...params,
  };
}
export function makeParamsOps(
  params: Partial<PatientImportParamsOps> = {}
): PatientImportParamsOps {
  return {
    rerunPdOnNewDemographics: false,
    triggerConsolidated: false,
    disableWebhooks: false,
    ...params,
  };
}
