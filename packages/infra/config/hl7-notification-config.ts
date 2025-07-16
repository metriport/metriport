import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";

export interface Hl7NotificationConfig {
  secrets: {
    HL7_BASE64_SCRAMBLER_SEED: string;
  };
  deprecatedIncomingMessageBucketName: string;
  incomingMessageBucketName: string;
  outgoingMessageBucketName: string;
  hl7ConversionBucketName: string;
  notificationWebhookSenderQueue: {
    arn: string;
    url: string;
  };
  mllpServer: {
    sentryDSN: string;
    fargateCpu: number;
    fargateMemoryLimitMiB: number;
    fargateTaskCountMin: number;
    fargateTaskCountMax: number;
    nlbInternalIpAddressA: string;
    nlbInternalIpAddressB: string;
  };
  hl7v2RosterUploadLambda: {
    bucketName: string;
  };
  hieConfigs: Record<string, HieConfig>;
  // ENG-536 remove this once we automatically find the discharge summary
  dischargeNotificationSlackUrl: string;
}
