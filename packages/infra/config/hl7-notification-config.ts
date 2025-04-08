export interface Hl7NotificationConfig {
  secrets: {
    HL7_BASE64_SCRAMBLER_SEED: string;
  };
  bucketName: string;
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
