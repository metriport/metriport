export const queryStatus = ["processing", "completed", "failed"] as const;
export type QueryStatus = (typeof queryStatus)[number];

export type QueryProgress = {
  status: QueryStatus;
  startedAt?: Date;
};

export type PatientDiscovery = {
  startedAt: Date;
  requestId: string;
};
