export interface Hl7v2Config {
  vpnConfigs: Hl7v2VpnConfig[];
}

export type Hl7v2VpnConfig = {
  customerName: string;
  customerGatewayPublicIp: string;
  preSharedKeyTunnel1: string;
  preSharedKeyTunnel2: string;
  bgpAsn: number;
  staticRoutesOnly: boolean;
  phase1LifetimeSeconds: number;
  phase2LifetimeSeconds: number;
};
