export interface Hl7NotificationRoutingConfig {
  vpnConfigs: Hl7NotificationRoutingVpnConfig[];
}

export type Hl7NotificationRoutingVpnConfig = {
  partnerName: string;
  partnerGatewayPublicIp: string;
  preSharedKeyTunnel1: string;
  preSharedKeyTunnel2: string;
  bgpAsn: number;
  staticRoutesOnly: boolean;
  phase1LifetimeSeconds: number;
  phase2LifetimeSeconds: number;
};
