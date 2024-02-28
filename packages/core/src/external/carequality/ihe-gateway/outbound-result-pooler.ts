export type PollOutboundResults = {
  requestId: string;
  patientId: string;
  cxId: string;
  numOfGateways: number;
};

export abstract class OutboundResultPoller {
  abstract isDQEnabled(): boolean;
  abstract pollOutboundDocQueryResults(params: PollOutboundResults): Promise<void>;

  abstract isDREnabled(): boolean;
  abstract pollOutboundDocRetrievalResults(params: PollOutboundResults): Promise<void>;
}
