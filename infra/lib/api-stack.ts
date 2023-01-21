import { Aspects, CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { InstanceType, Port } from "aws-cdk-lib/aws-ec2";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";
import * as rds from "aws-cdk-lib/aws-rds";
import { Credentials } from "aws-cdk-lib/aws-rds";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "./env-config";
import { EnvType } from "./env-type";
import { addErrorAlarmToLambdaFunc } from "./util";

interface APIStackProps extends StackProps {
  config: EnvConfig;
}

export class APIStack extends Stack {
  constructor(scope: Construct, id: string, props: APIStackProps) {
    super(scope, id, props);

    //-------------------------------------------
    // Secrets
    //-------------------------------------------
    const buildSecret = (name: string): secret.ISecret =>
      secret.Secret.fromSecretNameV2(this, name, name);
    const apiSecrets: { [key: string]: ecs.Secret } = {};
    for (const key of Object.keys(props.config.providerSecretNames)) {
      apiSecrets[key] = ecs.Secret.fromSecretsManager(
        buildSecret(
          (props.config.providerSecretNames as { [index: string]: any })[key]
        )
      );
    }

    //-------------------------------------------
    // VPC + NAT Gateway
    //-------------------------------------------
    const vpcConstructId = "APIVpc";
    const vpc = new ec2.Vpc(this, vpcConstructId, {
      flowLogs: {
        apiVPCFlowLogs: { trafficType: ec2.FlowLogTrafficType.REJECT },
      },
    });

    //-------------------------------------------
    // Security Setup
    //-------------------------------------------

    // Create a cert for HTTPS
    const zone = r53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.config.host,
    });
    const certificate = new cert.DnsValidatedCertificate(this, "APICert", {
      domainName: props.config.domain,
      hostedZone: zone,
      subjectAlternativeNames: [`*.${props.config.domain}`],
    });

    // add error alarming to CDK-generated lambdas
    const certificateRequestorLambda = certificate.node.findChild(
      "CertificateRequestorFunction"
    ) as unknown as lambda.SingletonFunction;
    addErrorAlarmToLambdaFunc(
      this,
      certificateRequestorLambda,
      "APICertificateCertificateRequestorFunctionAlarm"
    );

    //-------------------------------------------
    // Aurora Database for backend data
    //-------------------------------------------

    // create database credentials
    const dbUsername = props.config.dbUsername;
    const dbName = props.config.dbName;
    const dbClusterName = "api-cluster";
    const dbCredsSecret = new secret.Secret(this, "DBCreds", {
      secretName: `DBCreds`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: dbUsername,
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: "password",
      },
    });
    const dbCreds = Credentials.fromSecret(dbCredsSecret);
    // aurora serverlessv2 db
    const dbCluster = new rds.DatabaseCluster(this, "APIDB", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_4,
      }),
      instanceProps: { vpc: vpc, instanceType: new InstanceType("serverless") },
      credentials: dbCreds,
      defaultDatabaseName: dbName,
      clusterIdentifier: dbClusterName,
      storageEncrypted: true,
    });

    const minDBCap = this.isProd(props) ? 2 : 1;
    const maxDBCap = this.isProd(props) ? 8 : 2;
    Aspects.of(dbCluster).add({
      visit(node) {
        if (node instanceof rds.CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: minDBCap,
            maxCapacity: maxDBCap,
          };
        }
      },
    });

    //----------------------------------------------------------
    // DynamoDB
    //----------------------------------------------------------

    // global table for auth token management
    const dynamoDBTokenTable = new dynamodb.Table(this, "APIUserTokens", {
      partitionKey: { name: "token", type: dynamodb.AttributeType.STRING },
      replicationRegions: this.isProd(props) ? ["us-east-1"] : undefined,
      replicationTimeout: this.isProd(props) ? Duration.hours(3) : undefined,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: this.isProd(props) ? true : undefined,
    });
    dynamoDBTokenTable.addGlobalSecondaryIndex({
      indexName: "oauthUserAccessToken_idx",
      partitionKey: {
        name: "oauthUserAccessToken",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    //-------------------------------------------
    // ECR + ECS + Fargate for Backend Servers
    //-------------------------------------------

    // Create a new Amazon Elastic Container Service (ECS) cluster
    const cluster = new ecs.Cluster(this, "APICluster", {
      vpc: vpc,
    });

    // Create a Docker image and upload it to the Amazon Elastic Container Registry (ECR)
    const dockerImage = new ecr_assets.DockerImageAsset(this, "APIImage", {
      directory: "../api/app",
    });

    const connectWidgetUrlEnvVar = props.config.connectWidgetUrl
      ? props.config.connectWidgetUrl
      : `https://${props.config.connectWidget!.subdomain}.${
          props.config.connectWidget!.domain
        }/`;

    // Run some servers on fargate containers
    const fargateService = new ecs_patterns.NetworkLoadBalancedFargateService(
      this,
      "APIFargateService",
      {
        cluster: cluster,
        cpu: this.isProd(props) ? 2048 : 1024,
        desiredCount: this.isProd(props) ? 2 : 1,
        taskImageOptions: {
          image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
          containerPort: 8080,
          containerName: "API-Server",
          secrets: {
            DB_CREDS: ecs.Secret.fromSecretsManager(dbCredsSecret),
            ...apiSecrets,
          },
          environment: {
            NODE_ENV: "production",
            ENV_TYPE: props.config.environmentType,
            TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
            API_URL: `https://${props.config.subdomain}.${props.config.domain}`,
            CONNECT_WIDGET_URL: connectWidgetUrlEnvVar,
            ...(props.config.usageReportUrl && {
              USAGE_URL: props.config.usageReportUrl,
            }),
          },
        },
        memoryLimitMiB: this.isProd(props) ? 4096 : 2048,
        healthCheckGracePeriod: Duration.seconds(60),
        publicLoadBalancer: false,
      }
    );
    // This speeds up deployments so the tasks are swapped quicker.
    // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay
    fargateService.targetGroup.setAttribute(
      "deregistration_delay.timeout_seconds",
      "17"
    );

    // This also speeds up deployments so the health checks have a faster turnaround.
    // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/target-group-health-checks.html
    fargateService.targetGroup.configureHealthCheck({
      healthyThresholdCount: 2,
      interval: Duration.seconds(10),
    });

    // Access grant for Aurora DB
    dbCreds.secret?.grantRead(fargateService.taskDefinition.taskRole);
    dbCluster.connections.allowDefaultPortFrom(fargateService.service);

    // RW grant for Dynamo DB
    dynamoDBTokenTable.grantReadWriteData(
      fargateService.taskDefinition.taskRole
    );

    // hookup autoscaling based on 90% thresholds
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: this.isProd(props) ? 2 : 1,
      maxCapacity: this.isProd(props) ? 10 : 2,
    });
    scaling.scaleOnCpuUtilization("autoscale_cpu", {
      targetUtilizationPercent: 90,
      scaleInCooldown: Duration.minutes(2),
      scaleOutCooldown: Duration.seconds(30),
    });
    scaling.scaleOnMemoryUtilization("autoscale_mem", {
      targetUtilizationPercent: 90,
      scaleInCooldown: Duration.minutes(2),
      scaleOutCooldown: Duration.seconds(30),
    });

    // allow the NLB to talk to fargate
    fargateService.service.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.allTraffic(),
      "Allow traffic from within the VPC to the service secure port"
    );

    // setup a private link so the API can talk to the NLB
    const link = new apig.VpcLink(this, "link", {
      targets: [fargateService.loadBalancer],
    });

    const integration = new apig.Integration({
      type: apig.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apig.ConnectionType.VPC_LINK,
        vpcLink: link,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
        },
      },
      integrationHttpMethod: "ANY",
      uri: `http://${fargateService.loadBalancer.loadBalancerDnsName}/{proxy}`,
    });

    //-------------------------------------------
    // API Gateway
    //-------------------------------------------

    // Create the API Gateway
    // example from https://bobbyhadz.com/blog/aws-cdk-api-gateway-example
    const api = new apig.RestApi(this, "api", {
      description: "Metriport API Gateway",
      defaultIntegration: integration,
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
      },
    });

    // add domain cert + record
    const apiUrl = `${props.config.subdomain}.${props.config.domain}`;
    api.addDomainName("APIDomain", {
      domainName: apiUrl,
      certificate: certificate,
      securityPolicy: apig.SecurityPolicy.TLS_1_2,
    });
    new r53.ARecord(this, "APIDomainRecord", {
      recordName: apiUrl,
      zone: zone,
      target: r53.RecordTarget.fromAlias(new r53_targets.ApiGateway(api)),
    });

    // add basic usage plan
    const plan = api.addUsagePlan("APIUsagePlan", {
      name: "Base Plan",
      description: "Base Plan for API",
      apiStages: [{ api: api, stage: api.deploymentStage }],
      throttle: {
        burstLimit: 10,
        rateLimit: 50,
      },
      quota: {
        limit: this.isProd(props) ? 10000 : 500,
        period: apig.Period.DAY,
      },
    });

    // create the proxy to the fargate service
    const proxy = new apig.ProxyResource(this, `${id}/Proxy`, {
      parent: api.root,
      anyMethod: false,
    });
    proxy.addMethod("ANY", integration, {
      requestParameters: {
        "method.request.path.proxy": true,
      },
      apiKeyRequired: true,
    });

    // token auth for connect sessions
    const tokenAuthLambda = new lambda_node.NodejsFunction(
      this,
      "APITokenAuthLambda",
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: "../api/lambdas/token-auth/index.js",
        environment: {
          TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
        },
      }
    );
    addErrorAlarmToLambdaFunc(this, tokenAuthLambda, "TokenAuthFunctionAlarm");

    const tokenAuth = new apig.RequestAuthorizer(this, "APITokenAuth", {
      handler: tokenAuthLambda,
      identitySources: ["method.request.querystring.state"],
      // todo: instead of removing caching, investigate explicitly listing
      //        the permitted methods in the lambda: "Resource: event.methodArn"
      //
      // see: https://forum.serverless.com/t/rest-api-with-custom-authorizer-how-are-you-dealing-with-authorization-and-policy-cache/3310
      resultsCacheTtl: Duration.minutes(0),
    });
    dynamoDBTokenTable.grantReadData(tokenAuthLambda.role!);

    // setup /token path with token auth
    const apiTokenResource = api.root.addResource("token");
    const tokenProxy = new apig.ProxyResource(this, `${id}/token/Proxy`, {
      parent: apiTokenResource,
      anyMethod: false,
    });
    const integrationToken = new apig.Integration({
      type: apig.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apig.ConnectionType.VPC_LINK,
        vpcLink: link,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
          "integration.request.header.api-token":
            "context.authorizer.api-token",
          "integration.request.header.cxId": "context.authorizer.cxId",
          "integration.request.header.userId": "context.authorizer.userId",
        },
      },
      integrationHttpMethod: "ANY",
      uri: `http://${fargateService.loadBalancer.loadBalancerDnsName}/{proxy}`,
    });
    tokenProxy.addMethod("ANY", integrationToken, {
      requestParameters: {
        "method.request.path.proxy": true,
      },
      authorizer: tokenAuth,
    });

    // WEBHOOKS
    const webhookResource = api.root.addResource("webhook");

    this.setupGarminWebhookAuth({
      baseResource: webhookResource,
      vpc,
      fargateService,
      dynamoDBTokenTable,
    });

    // add webhook path for apple health clients
    const appleHealthResource = webhookResource.addResource("apple");
    const integrationApple = new apig.Integration({
      type: apig.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apig.ConnectionType.VPC_LINK,
        vpcLink: link,
      },
      integrationHttpMethod: "POST",
      uri: `http://${fargateService.loadBalancer.loadBalancerDnsName}${appleHealthResource.path}`,
    });
    appleHealthResource.addMethod("POST", integrationApple, {
      apiKeyRequired: true,
    });

    // add another usage plan for Publishable (Client) API keys
    // everything is throttled to 0 - except explicitely permitted routes
    const appleHealthThrottleKey = `${appleHealthResource.path}/POST`;
    const clientPlan = new apig.CfnUsagePlan(this, "APIClientUsagePlan", {
      usagePlanName: "Client Plan",
      description: "Client Plan for API",
      apiStages: [
        {
          apiId: api.restApiId,
          stage: api.deploymentStage.stageName,
          throttle: {
            "*/*": { burstLimit: 0, rateLimit: 0 },
            [appleHealthThrottleKey]: { burstLimit: 10, rateLimit: 50 },
          },
        },
      ],
      throttle: {
        burstLimit: 10,
        rateLimit: 50,
      },
      quota: {
        limit: this.isProd(props) ? 10000 : 500,
        period: apig.Period.DAY,
      },
    });

    //-------------------------------------------
    // Output
    //-------------------------------------------
    new CfnOutput(this, "APIGatewayUrl", {
      description: "API Gateway URL",
      value: api.url,
    });
    new CfnOutput(this, "APIGatewayID", {
      description: "API Gateway ID",
      value: api.restApiId,
    });
    new CfnOutput(this, "APIGatewayRootResourceID", {
      description: "API Gateway Root Resource ID",
      value: api.root.resourceId,
    });
    new CfnOutput(this, "APIGatewayWebhookResourceID", {
      description: "API Gateway Webhook Resource ID",
      value: webhookResource.resourceId,
    });
    new CfnOutput(this, "VPCID", {
      description: "VPC ID",
      value: vpc.vpcId,
    });
    new CfnOutput(this, "DBClusterID", {
      description: "DB Cluster ID",
      value: dbCluster.clusterIdentifier,
    });
    new CfnOutput(this, "FargateServiceARN", {
      description: "Fargate Service ARN",
      value: fargateService.service.serviceArn,
    });
    new CfnOutput(this, "APIECSClusterARN", {
      description: "API ECS Cluster ARN",
      value: cluster.clusterArn,
    });
    new CfnOutput(this, "APIUsagePlan", {
      description: "API Usage Plan",
      value: plan.usagePlanId,
    });
    new CfnOutput(this, "ClientAPIUsagePlan", {
      description: "Client API Usage Plan",
      value: clientPlan.attrId,
    });
    new CfnOutput(this, "APIDBCluster", {
      description: "API DB Cluster",
      value: `${dbCluster.clusterEndpoint.hostname} ${dbCluster.clusterEndpoint.port} ${dbCluster.clusterEndpoint.socketAddress}`,
    });
  }

  private setupGarminWebhookAuth(ownProps: {
    baseResource: apig.Resource;
    vpc: ec2.IVpc;
    fargateService: ecs_patterns.NetworkLoadBalancedFargateService;
    dynamoDBTokenTable: dynamodb.Table;
  }) {
    const {
      baseResource,
      vpc,
      fargateService: server,
      dynamoDBTokenTable,
    } = ownProps;

    const garminLambda = new lambda_node.NodejsFunction(this, "GarminLambda", {
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "../api/lambdas/garmin/index.js",
      environment: {
        TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
        API_URL: `http://${server.loadBalancer.loadBalancerDnsName}/webhook/garmin`,
      },
      vpc,
    });
    addErrorAlarmToLambdaFunc(this, garminLambda, "GarminAuthFunctionAlarm");

    // Grant lambda access to the DynamoDB token table
    dynamoDBTokenTable.grantReadData(garminLambda.role!);

    // Grant lambda access to the api server
    server.service.connections.allowFrom(garminLambda, Port.allTcp());

    // setup $base/garmin path with token auth
    const garminResource = baseResource.addResource("garmin");
    garminResource.addMethod("ANY", new apig.LambdaIntegration(garminLambda));
  }

  private isProd(props: APIStackProps): boolean {
    return props.config.environmentType === EnvType.production;
  }
}
