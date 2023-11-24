export const XCPD_STRING = "XCPD ITI-55";
export const XCA_DQ_STRING = "XCA ITI-38";
export const XCA_DR_STRING = "XCA ITI-39";

export const channelUrls = [XCPD_STRING, XCA_DQ_STRING, XCA_DR_STRING];
export type ChannelUrl = (typeof channelUrls)[number];

export const TRANSACTION_URL = "Transaction";
export const ORG_POSITION = "OrgPosition";
