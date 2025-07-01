export type PollOutboundResults = {
  requestId: string;
  patientId: string;
  cxId: string;
  numOfGateways: number;
  maxPollingDuration?: number;
  forceDownload?: boolean;
};

export abstract class OutboundResultPoller {
  abstract isPDEnabled(lambdaName?: string | undefined): boolean;
  abstract pollOutboundPatientDiscoveryResults(params: PollOutboundResults): Promise<void>;

  abstract isDQEnabled(lambdaName?: string | undefined): boolean;
  abstract pollOutboundDocQueryResults(params: PollOutboundResults): Promise<void>;

  abstract isDREnabled(lambdaName?: string | undefined): boolean;
  abstract pollOutboundDocRetrievalResults(params: PollOutboundResults): Promise<void>;
}
