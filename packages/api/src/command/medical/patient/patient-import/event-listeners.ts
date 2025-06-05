import {
  DataPipelineEvent,
  DataPipelineEvents,
  dataPipelineEvents,
} from "@metriport/core/command/data-pipeline/event";
import { emptyFunction } from "@metriport/shared";
import { finishSinglePatientImport } from "./finish-single-patient";

export function initBulkImportEventListeners() {
  dataPipelineEvents().on(DataPipelineEvents.SUCCEEDED, processDataPipelineSucceeded);
  dataPipelineEvents().on(DataPipelineEvents.FAILED, processDataPipelineFailed);
}

function processDataPipelineSucceeded(dataPipeline: DataPipelineEvent) {
  finishSinglePatientImport({
    ...dataPipeline,
    status: "successful",
  }).catch(emptyFunction);
}

function processDataPipelineFailed(dataPipeline: DataPipelineEvent) {
  finishSinglePatientImport({
    ...dataPipeline,
    status: "failed",
  }).catch(emptyFunction);
}
