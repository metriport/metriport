/**
 * Based on https://github.com/makit/aws-opensearch-serverless
 */
import { CfnOutput, RemovalPolicy, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { EbsDeviceVolumeType } from "aws-cdk-lib/aws-ec2";
import { Domain, EngineVersion } from "aws-cdk-lib/aws-opensearchservice";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { getConfig } from "./config";
import { isProd, isSandbox } from "./util";
// import * as cdk from 'aws-cdk-lib';
// import * as ops from 'aws-cdk-lib/aws-opensearchserverless';

// const ccdaCollectionName = "ccda-collection";
const ccdaDomainName = "ccda-collection";

export function settings() {
  const config = getConfig();
  const isLarge = isProd(config) || isSandbox(config);
  // Watch out for the combination of vCPUs and memory, more vCPU requires more memory
  // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
  // const cpuAmount = prod ? 4 : 2;
  return {
    // https://docs.aws.amazon.com/opensearch-service/latest/developerguide/supported-instance-types.html
    capacity: {
      dataNodes: isLarge ? 2 : 1,
      dataNodeInstanceType: isLarge ? "t3.small.search" : "t3.small.search",
      masterNodes: isLarge ? 3 : undefined, // when not large this is done by data nodes
      masterNodeInstanceType: isLarge ? "t3.small.search" : undefined,
    },
    ebs: {
      volumeSize: 10,
      volumeType: EbsDeviceVolumeType.GENERAL_PURPOSE_SSD,
    },
  };
}

export interface OpenSearchConstructProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
}

export default class OpenSearchConstruct extends Construct {
  public readonly ccdaDomainId: string;
  public readonly ccdaDomainEndpoint: string;

  constructor(scope: Construct, id: string, props: OpenSearchConstructProps) {
    super(scope, id);

    const { vpc, env } = props;
    const { capacity, ebs } = settings();
    if (!env) throw new Error("env is required");

    // const secrets = getSecrets(this, props.config);
    const secretName = "OpenSearchSecretName";
    const credsSecret = new secret.Secret(this, secretName, {
      secretName,
      generateSecretString: {
        // secretStringTemplate: JSON.stringify({
        //   username: dbUsername,
        // }),
        excludePunctuation: true,
        includeSpace: false,
        // generateStringKey: "password",
      },
    });

    // // See https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-manage.html
    // const collection = new ops.CfnCollection(this, "CCDACollection", {
    //   name: ccdaCollectionName,
    //   type: "SEARCH",
    // });
    // // Encryption policy is needed in order for the collection to be created
    // const encPolicy = new ops.CfnSecurityPolicy(this, "CCDASecurityPolicy", {
    //   name: "ccda-collection-policy",
    //   policy: `{"Rules":[{"ResourceType":"collection","Resource":["collection/${ccdaCollectionName}"]}],"AWSOwnedKey":true}`,
    //   type: "encryption",
    // });
    // collection.addDependency(encPolicy);
    // // Network policy is required so that the dashboard can be viewed!
    // const netPolicy = new ops.CfnSecurityPolicy(this, "CCDANetworkPolicy", {
    //   name: "ccda-network-policy",
    //   policy:
    //     '[{"Rules":[{"ResourceType":"collection","Resource":["collection/ccda-collection"]}, {"ResourceType":"dashboard","Resource":["collection/ccda-collection"]}],"AllowFromPublic":false}]',
    //   type: "network",
    // });
    // collection.addDependency(netPolicy);
    // this.ccdaDomainId = collection.attrId;
    // this.ccdaDomainEndpoint = collection.attrCollectionEndpoint;
    // new cdk.CfnOutput(this, "DashboardEndpoint", {
    //   value: collection.attrDashboardEndpoint,
    // });
    // ##########

    // const prefix = "dev-opensearch";
    // const osVpc = new Vpc(this, `${prefix}-vpc`, {
    //   vpcName: prefix,
    //   natGateways: 1
    // });
    // const osSg = new ec2.SecurityGroup(this, `${id}-sg`, {
    //   securityGroupName: `${id}-sg`,
    //   vpc,
    // });
    // ##########
    const ccdaDomain = new Domain(this, ccdaDomainName, {
      domainName: ccdaDomainName,
      version: EngineVersion.OPENSEARCH_1_2,
      removalPolicy: RemovalPolicy.DESTROY,
      enableVersionUpgrade: true,
      capacity,
      ebs,
      vpc,
      vpcSubnets: [
        {
          subnets: vpc.privateSubnets,
          // subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          availabilityZones: [`${env.region}a`],
          onePerAz: true,
        },
      ],
      encryptionAtRest: {
        enabled: true,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,
      // securityGroups: [osSg],
      fineGrainedAccessControl: {
        masterUserName: "admin",
        masterUserPassword: credsSecret.secretValue,
      },
      logging: {
        slowSearchLogEnabled: true,
        slowIndexLogEnabled: true,
        appLogEnabled: true,
      },
      // zoneAwareness: {
      //   enabled: true,
      // },
    });
    this.ccdaDomainId = ccdaDomain.domainId;
    this.ccdaDomainEndpoint = ccdaDomain.domainEndpoint;

    new CfnOutput(this, "CCDADomainID", {
      description: "OpenSearch CCDA Domain ID",
      value: this.ccdaDomainId,
    });
    new CfnOutput(this, "CCDADomainEndpoint", {
      description: "OpenSearch CCDA Domain Endpoint",
      value: this.ccdaDomainEndpoint,
    });
  }
}
