export interface Hl7NotificationConfig {
  apiVpcId: string;
  vpnConfigs: Hl7NotificationVpnConfig[];
  mllpServer: {
    fargateCpu: number;
    fargateMemoryLimitMiB: number;
    fargateTaskCountMin: number;
    fargateTaskCountMax: number;
  };
}

export type Hl7NotificationVpnConfig = {
  partnerName: string;
  partnerGatewayPublicIp: string;
  partnerInternalCidrBlock: string;
};
