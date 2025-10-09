import { HieConfig, VpnlessHieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { HieSftpConfig } from "@metriport/core/external/sftp/types";

export interface Hl7NotificationConfig {
  secrets: {
    HL7_BASE64_SCRAMBLER_SEED: string;
    LAHIE_INGESTION_PASSPHRASE: string;
    LAHIE_INGESTION_PRIVATE_KEY: string;
    LAHIE_INGESTION_PASSWORD: string;
    ALOHR_INGESTION_PASSWORD: string;
  };
  deprecatedIncomingMessageBucketName: string;
  incomingMessageBucketName: string;
  rawIncomingMessageBucketName: string;
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
  LahieSftpIngestionLambda: {
    sftpConfig: HieSftpConfig;
    bucketName: string;
  };
  AlohrSftpIngestionLambda: {
    sftpConfig: HieSftpConfig;
    bucketName: string;
  };
  hieConfigs: Record<string, HieConfig | VpnlessHieConfig>;
  // ENG-536 remove this once we automatically find the discharge summary
  dischargeNotificationSlackUrl: string;
}
