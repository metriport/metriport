import { Construct } from "constructs";
import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { LambdaSettingsWithNameAndEntry } from "../shared/settings";
import { EnvType } from "../env-type";
import { EnvConfig } from "../../config/env-config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createLambda } from "../shared/lambda";
import { buildSecret } from "../shared/secrets";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SDEAssets } from "./types";
import { createBucket } from "../shared/bucket";

const extractDocumentLambdaTimeout = Duration.minutes(5);

interface SDENestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alertAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

interface SDELambdaSettings {
  extractDocument: LambdaSettingsWithNameAndEntry;
}

const sdeLambda: SDELambdaSettings = {
  extractDocument: {
    name: "ExtractStructuredData",
    entry: "sde/extract-document",
    lambda: {
      memory: 1024,
      timeout: extractDocumentLambdaTimeout,
    },
  },
};

export class SDEStack extends NestedStack {
  private readonly structuredDataBucket: s3.Bucket;
  private readonly extractDocumentLambda: Lambda;

  constructor(scope: Construct, id: string, props: SDENestedStackProps) {
    super(scope, id, props);

    const structuredDataBucketName = props.config.structuredDataBucketName;
    if (!structuredDataBucketName) throw new Error("structuredDataBucketName is required");
    this.structuredDataBucket = createBucket(
      this,
      {
        bucketName: structuredDataBucketName,
        versioned: true,
      },
      "StructuredDataBucket"
    );

    const envVars: Record<string, string> = {
      STRUCTURED_DATA_BUCKET_NAME: this.structuredDataBucket.bucketName,
      ...(props.config.baseten && {
        BASETEN_API_KEY_SECRET: props.config.baseten.secretNames.BASETEN_API_KEY,
        BASETEN_BASE_URL: props.config.baseten.basetenBaseUrl,
      }),
    };

    const commonConfig = {
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alertAction: props.alertAction,
      quest: props.config.quest,
      systemRootOID: props.config.systemRootOID,
      termServerUrl: props.config.termServerUrl,
      envVars,
    };

    this.extractDocumentLambda = this.setupLambda("extractDocument", {
      ...commonConfig,
      structuredDataBucket: this.structuredDataBucket,
    });

    if (props.config.baseten) {
      const basetenApiKeySecret = buildSecret(
        this,
        props.config.baseten.secretNames.BASETEN_API_KEY
      );
      basetenApiKeySecret.grantRead(this.extractDocumentLambda);
    }
  }

  getLambdas(): Lambda[] {
    return [this.extractDocumentLambda];
  }

  getAssets(): SDEAssets {
    return {
      structuredDataBucket: this.structuredDataBucket,
      extractDocumentLambda: this.extractDocumentLambda,
    };
  }

  private setupLambda<T extends keyof SDELambdaSettings>(
    lambdaName: T,
    props: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      envType: EnvType;
      envVars: Record<string, string>;
      sentryDsn: string | undefined;
      alertAction: SnsAction | undefined;
      systemRootOID: string;
      structuredDataBucket: s3.Bucket;
    }
  ): Lambda {
    const { name, entry, lambda: lambdaSettings } = sdeLambda[lambdaName];

    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alertAction,
      systemRootOID,
      structuredDataBucket,
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
        SYSTEM_ROOT_OID: systemRootOID,
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    structuredDataBucket.grantReadWrite(lambda);
    return lambda;
  }
}
