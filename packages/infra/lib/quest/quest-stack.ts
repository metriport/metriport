import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";
import { createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { buildSecret } from "../shared/secrets";
import { LambdaSettingsWithNameAndEntry } from "../shared/settings";
import { QuestAssets } from "./types";

const sftpActionTimeout = Duration.seconds(30);
// Can take up to 3 minutes to load roster in batches, upload to S3, and send over SFTP
const rosterUploadLambdaTimeout = Duration.minutes(3);
// When a response is downloaded, the remote SFTP server deletes it automatically, so this ensures that even a very
// large response file does not time out (and thus get lost in transit)
const responseDownloadLambdaTimeout = Duration.minutes(1);
// After downloading a response file, a separate conversion Lambda is triggered for each patient in the response file
const convertResponseLambdaTimeout = Duration.seconds(30);

interface QuestLambdaSettings {
  sftpAction: LambdaSettingsWithNameAndEntry;
  rosterUpload: LambdaSettingsWithNameAndEntry;
  responseDownload: LambdaSettingsWithNameAndEntry;
  convertResponse: LambdaSettingsWithNameAndEntry;
}

const questLambdaSettings: QuestLambdaSettings = {
  sftpAction: {
    name: "QuestSftpAction",
    entry: "quest/sftp-action",
    lambda: {
      memory: 1024,
      timeout: sftpActionTimeout,
    },
  },
  rosterUpload: {
    name: "QuestRosterUpload",
    entry: "quest/roster-upload",
    lambda: {
      memory: 1024,
      timeout: rosterUploadLambdaTimeout,
    },
  },
  responseDownload: {
    name: "QuestResponseDownload",
    entry: "quest/response-download",
    lambda: {
      memory: 1024,
      timeout: responseDownloadLambdaTimeout,
    },
  },
  convertResponse: {
    name: "QuestConvertResponse",
    entry: "quest/convert-response",
    lambda: {
      memory: 1024,
      timeout: convertResponseLambdaTimeout,
    },
  },
};

function questEnvironmentVariablesAndSecrets({
  nestedStack,
  quest,
  questReplicaBucket,
  labConversionBucket,
}: {
  nestedStack: QuestNestedStack;
  quest: EnvConfig["quest"];
  questReplicaBucket: s3.Bucket;
  labConversionBucket: s3.Bucket;
}): { envVars: Record<string, string>; secrets: secret.ISecret[] } {
  if (!quest) {
    return { envVars: {}, secrets: [] };
  }

  const envVars: Record<string, string> = {
    QUEST_SFTP_HOST: quest.questHostname,
    QUEST_SFTP_USERNAME: quest.questUsername,
    QUEST_SFTP_PORT: quest.questPort.toString(),
    QUEST_REPLICA_BUCKET_NAME: questReplicaBucket.bucketName,
    LAB_CONVERSION_BUCKET_NAME: labConversionBucket.bucketName,
    QUEST_INCOMING_DIRECTORY_PATH: quest.questIncomingDirectoryPath,
    QUEST_OUTGOING_DIRECTORY_PATH: quest.questOutgoingDirectoryPath,
  };

  const secrets: secret.ISecret[] = [];
  const senderPasswordSecret = buildSecret(nestedStack, quest.secrets.QUEST_SFTP_PASSWORD);
  envVars.QUEST_SFTP_PASSWORD_NAME = senderPasswordSecret.secretName;
  secrets.push(senderPasswordSecret);
  return { envVars, secrets };
}

interface QuestNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class QuestNestedStack extends NestedStack {
  private readonly sftpActionLambda: Lambda;
  private readonly rosterUploadLambda: Lambda;
  private readonly responseDownloadLambda: Lambda;
  private readonly convertResponseLambda: Lambda;
  private readonly questReplicaBucket: s3.Bucket;
  private readonly labConversionBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: QuestNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.questReplicaBucket = new s3.Bucket(this, "QuestReplicaBucket", {
      bucketName: props.config.questReplicaBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    this.labConversionBucket = new s3.Bucket(this, "LabConversionBucket", {
      bucketName: props.config.labConversionBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      // Required for presigned URLs
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET],
        },
      ],
    });

    const { envVars, secrets } = questEnvironmentVariablesAndSecrets({
      nestedStack: this,
      quest: props.config.quest,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });

    const commonConfig = {
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      quest: props.config.quest,
      systemRootOID: props.config.systemRootOID,
      envVars,
    };

    const sftpAction = this.setupLambda("sftpAction", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });
    this.sftpActionLambda = sftpAction.lambda;

    const rosterUpload = this.setupLambda("rosterUpload", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });
    this.rosterUploadLambda = rosterUpload.lambda;

    const responseDownload = this.setupLambda("responseDownload", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });
    this.responseDownloadLambda = responseDownload.lambda;

    const convertResponse = this.setupLambda("convertResponse", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });
    this.convertResponseLambda = convertResponse.lambda;

    const lambdas = this.getLambdas();
    for (const secret of secrets) {
      for (const lambda of lambdas) {
        secret.grantRead(lambda);
      }
    }
  }

  getLambdas(): Lambda[] {
    return [
      this.sftpActionLambda,
      this.rosterUploadLambda,
      this.responseDownloadLambda,
      this.convertResponseLambda,
    ];
  }

  getAssets(): QuestAssets {
    return {
      questLambdas: [
        {
          envVarName: "QUEST_SFTP_ACTION_LAMBDA_NAME",
          lambda: this.sftpActionLambda,
        },
        {
          envVarName: "QUEST_ROSTER_UPLOAD_LAMBDA_NAME",
          lambda: this.rosterUploadLambda,
        },
        {
          envVarName: "QUEST_RESPONSE_DOWNLOAD_LAMBDA_NAME",
          lambda: this.responseDownloadLambda,
        },
        {
          envVarName: "QUEST_CONVERT_RESPONSE_LAMBDA_NAME",
          lambda: this.convertResponseLambda,
        },
      ],
      sftpActionLambda: this.sftpActionLambda,
      rosterUploadLambda: this.rosterUploadLambda,
      responseDownloadLambda: this.responseDownloadLambda,
      convertResponseLambda: this.convertResponseLambda,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    };
  }

  private setupLambda<T extends keyof QuestLambdaSettings>(
    job: T,
    props: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      envType: EnvType;
      envVars: Record<string, string>;
      sentryDsn: string | undefined;
      alarmAction: SnsAction | undefined;
      systemRootOID: string;
      questReplicaBucket: s3.Bucket;
      labConversionBucket?: s3.Bucket;
    }
  ) {
    const { name, entry, lambda: lambdaSettings } = questLambdaSettings[job];

    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alarmAction,
      systemRootOID,
      questReplicaBucket,
      labConversionBucket,
    } = props;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        ...envVars,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        ...(job === "sftpAction" ? { SFTP_ACTION_LAMBDA: "quest" } : {}),
        SYSTEM_ROOT_OID: systemRootOID,
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    questReplicaBucket.grantReadWrite(lambda);
    labConversionBucket?.grantReadWrite(lambda);

    return { lambda };
  }
}
