export interface Hl7NotificationConfig {
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
  staticRoutesOnly: boolean;
  phase1LifetimeSeconds?: number;
  phase2LifetimeSeconds?: number;
};
