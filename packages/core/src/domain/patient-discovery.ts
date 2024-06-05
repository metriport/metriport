export type ScheduledPatientDiscovery = {
  requestId: string;
  facilityId: string;
  orgIdExcludeList?: string[];
  rerunPdOnNewDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
};

export type DiscoveryParams = {
  requestId: string;
  facilityId: string;
  startedAt: Date;
  rerunPdOnNewDemographics: boolean;
};
