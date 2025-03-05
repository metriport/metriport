export interface Hl7NotificationRoutingConfig {
  vpnConfigs: Hl7NotificationRoutingVpnConfig[];
  mllpServer: {
    fargateCpu: number;
    fargateMemoryLimitMiB: number;
    fargateTaskCountMin: number;
    fargateTaskCountMax: number;
  };
}

export type Hl7NotificationRoutingVpnConfig = {
  partnerName: string;
  partnerGatewayPublicIp: string;
  staticRoutesOnly: boolean;
  phase1LifetimeSeconds?: number;
  phase2LifetimeSeconds?: number;
};
