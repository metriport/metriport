import EventEmitter from "events";

export type DataPipelineEvent = { cxId: string; patientId: string; requestId: string };

let dataPipelineEventsInstance: DataPipelineEvents;

export const dataPipelineEvents = (): DataPipelineEvents => {
  if (!dataPipelineEventsInstance) {
    dataPipelineEventsInstance = new DataPipelineEvents();
  }
  return dataPipelineEventsInstance;
};

export class DataPipelineEvents extends EventEmitter {
  static readonly SUCCEEDED = "data-pipeline-succeeded";
  static readonly FAILED = "data-pipeline-failed";

  succeeded(dataPipeline: DataPipelineEvent) {
    this.emit(DataPipelineEvents.SUCCEEDED, dataPipeline);
  }

  failed(dataPipeline: DataPipelineEvent) {
    this.emit(DataPipelineEvents.FAILED, dataPipeline);
  }
}
