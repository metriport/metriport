export interface Hl7NotificationConfig {
  vpnConfigs: Hl7NotificationVpnConfig[];
  mllpServer: {
    fargateCpu: number;
    fargateMemoryLimitMiB: number;
    fargateTaskCountMin: number;
    fargateTaskCountMax: number;
  };
  hl7v2RosterUploadLambda: {
    bucketName: string;
  };
}

export type Hl7NotificationVpnConfig = {
  partnerName: string;
  partnerGatewayPublicIp: string;
  partnerInternalCidrBlock: string;
};
