export type PollOutboundResults = {
  requestId: string;
  patientId: string;
  cxId: string;
  numOfGateways: number;
  maxPollingDuration?: number;
};

export abstract class OutboundResultPoller {
  abstract isPDEnabled(): boolean;
  abstract pollOutboundPatientDiscoveryResults(params: PollOutboundResults): Promise<void>;

  abstract isDQEnabled(): boolean;
  abstract pollOutboundDocQueryResults(params: PollOutboundResults): Promise<void>;

  abstract isDREnabled(): boolean;
  abstract pollOutboundDocRetrievalResults(params: PollOutboundResults): Promise<void>;
}
