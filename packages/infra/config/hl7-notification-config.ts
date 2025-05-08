import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";

export interface Hl7NotificationConfig {
  secrets: {
    HL7_BASE64_SCRAMBLER_SEED: string;
  };
  deprecatedIncomingMessageBucketName: string;
  incomingMessageBucketName: string;
  outgoingMessageBucketName: string;
  notificationWebhookSenderQueue: {
    arn: string;
    url: string;
  };
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
  hieConfigs?: Record<string, HieConfig>;
}

export type Hl7NotificationVpnConfig = {
  partnerName: string;
  partnerGatewayPublicIp: string;
  partnerInternalCidrBlock: string;
};
