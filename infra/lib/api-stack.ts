import { Aspects, CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cognito from "aws-cdk-lib/aws-cognito";
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
import { getSecrets } from "./secrets";
import { addErrorAlarmToLambdaFunc, isProd, mbToBytes } from "./util";

interface APIStackProps extends StackProps {
  config: EnvConfig;
}

export class APIStack extends Stack {
  readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: APIStackProps) {
    super(scope, id, props);

    //-------------------------------------------
    // Secrets
    //-------------------------------------------
    const secrets = getSecrets(this, props.config);

    //-------------------------------------------
    // VPC + NAT Gateway
    //-------------------------------------------
    const vpcConstructId = "APIVpc";
    this.vpc = new ec2.Vpc(this, vpcConstructId, {
      flowLogs: {
        apiVPCFlowLogs: { trafficType: ec2.FlowLogTrafficType.REJECT },
      },
    });

    new r53.PrivateHostedZone(this, "PrivateZone", {
      vpc: this.vpc,
      zoneName: props.config.host,
    });
    const publicZone = r53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.config.host,
    });

    //-------------------------------------------
    // Security Setup
    //-------------------------------------------
    // Create a cert for HTTPS
    const certificate = new cert.DnsValidatedCertificate(this, "APICert", {
      domainName: props.config.domain,
      hostedZone: publicZone,
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
      instanceProps: { vpc: this.vpc, instanceType: new InstanceType("serverless") },
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

    // add performance alarms for monitoring prod environment
    if (this.isProd(props)) {
      this.addDBClusterPerformanceAlarms(dbCluster, dbClusterName);
    }

    //----------------------------------------------------------
    // DynamoDB
    //----------------------------------------------------------

    // global table for auth token management
    const dynamoConstructName = "APIUserTokens";
    const replicationRegion = props.config.region === "us-east-1" ? "us-east-2" : "us-east-1";
    const dynamoDBTokenTable = new dynamodb.Table(this, dynamoConstructName, {
      partitionKey: { name: "token", type: dynamodb.AttributeType.STRING },
      replicationRegions: this.isProd(props) ? [replicationRegion] : undefined,
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

    // add performance alarms for monitoring prod environment
    if (this.isProd(props)) {
      this.addDynamoPerformanceAlarms(dynamoDBTokenTable, dynamoConstructName);
    }

    //-------------------------------------------
    // ECR + ECS + Fargate for Backend Servers
    //-------------------------------------------

    // Create a new Amazon Elastic Container Service (ECS) cluster
    const cluster = new ecs.Cluster(this, "APICluster", {
      vpc: this.vpc,
    });

    // Create a Docker image and upload it to the Amazon Elastic Container Registry (ECR)
    const dockerImage = new ecr_assets.DockerImageAsset(this, "APIImage", {
      directory: "../api/app",
    });

    const connectWidgetUrlEnvVar =
      props.config.connectWidgetUrl != undefined
        ? props.config.connectWidgetUrl
        : `https://${props.config.connectWidget.subdomain}.${props.config.connectWidget.domain}/`;

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
            ...secrets,
          },
          environment: {
            NODE_ENV: "production",
            ENV_TYPE: props.config.environmentType,
            TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
            API_URL: `https://${props.config.subdomain}.${props.config.domain}`,
            CONNECT_WIDGET_URL: connectWidgetUrlEnvVar,
            SYSTEM_ROOT_OID: props.config.systemRootOID,
            GATEWAY_ENDPOINT_LOCATION: props.config.gatewayEndpointLocation,
            GATEWAY_AUTHORIZATION_SERVER_ENDPOINT: props.config.gatewayAuthorizationServerEndpoint,
            GATEWAY_AUTHORIZATION_CLIENT_ID: props.config.gatewayAuthorizationClientId,
            GATEWAY_AUTHORIZATION_CLIENT_SECRET: props.config.gatewayAuthorizationClientSecret,
            COMMONWELL_ORG_NAME: props.config.cwOrgName,
            COMMONWELL_MEMBER_OID: props.config.cwMemberOid,
            COMMONWELL_ORG_MANAGEMENT_PRIVATE_KEY: props.config.cwOrgManagementKey,
            COMMONWELL_ORG_MANAGEMENT_CERTIFICATE: props.config.cwOrgManagementCertification,
            COMMONWELL_MEMBER_PRIVATE_KEY: props.config.cwOrgMemberKey,
            COMMONWELL_MEMBER_CERTIFICATE: props.config.cwOrgMemberCertificate,
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
    const apiServerAddress = fargateService.loadBalancer.loadBalancerDnsName;

    // This speeds up deployments so the tasks are swapped quicker.
    // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay
    fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "17");

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
    dynamoDBTokenTable.grantReadWriteData(fargateService.taskDefinition.taskRole);

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
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
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
      uri: `http://${apiServerAddress}/{proxy}`,
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
      zone: publicZone,
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
    const tokenAuth = this.setupTokenAuthLambda(dynamoDBTokenTable);

    // setup /token path with token auth
    this.setupAPIGWApiTokenResource(id, api, link, tokenAuth, apiServerAddress);

    const userPoolClientSecret = this.setupOAuthUserPool();
    const oauthScopes = this.enableFHIROnUserPool(userPoolClientSecret);
    const oauthAuth = this.setupOAuthAuthorizer(userPoolClientSecret);
    this.setupAPIGWOAuthResource(id, api, link, oauthAuth, oauthScopes, apiServerAddress);

    // WEBHOOKS
    const webhookResource = api.root.addResource("webhook");

    this.setupGarminWebhookAuth({
      baseResource: webhookResource,
      vpc: this.vpc,
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
      uri: `http://${apiServerAddress}${appleHealthResource.path}`,
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
      value: this.vpc.vpcId,
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
    new CfnOutput(this, "ClientSecretUserpoolID", {
      description: "Userpool for client secret based apps",
      value: userPoolClientSecret.userPoolId,
    });
  }

  private setupGarminWebhookAuth(ownProps: {
    baseResource: apig.Resource;
    vpc: ec2.IVpc;
    fargateService: ecs_patterns.NetworkLoadBalancedFargateService;
    dynamoDBTokenTable: dynamodb.Table;
  }) {
    const { baseResource, vpc, fargateService: server, dynamoDBTokenTable } = ownProps;

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
    garminLambda.role && dynamoDBTokenTable.grantReadData(garminLambda.role);

    // Grant lambda access to the api server
    server.service.connections.allowFrom(garminLambda, Port.allTcp());

    // setup $base/garmin path with token auth
    const garminResource = baseResource.addResource("garmin");
    garminResource.addMethod("ANY", new apig.LambdaIntegration(garminLambda));
  }

  private setupTokenAuthLambda(dynamoDBTokenTable: dynamodb.Table): apig.RequestAuthorizer {
    const tokenAuthLambda = new lambda_node.NodejsFunction(this, "APITokenAuthLambda", {
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "../api/lambdas/token-auth/index.js",
      environment: {
        TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
      },
    });
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
    tokenAuthLambda.role && dynamoDBTokenTable.grantReadData(tokenAuthLambda.role);

    return tokenAuth;
  }

  private setupAPIGWApiTokenResource(
    stackId: string,
    api: apig.RestApi,
    link: apig.VpcLink,
    authorizer: apig.RequestAuthorizer,
    serverAddress: string
  ): apig.Resource {
    const apiTokenResource = api.root.addResource("token");
    const tokenProxy = new apig.ProxyResource(this, `${stackId}/token/Proxy`, {
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
          "integration.request.header.api-token": "context.authorizer.api-token",
          "integration.request.header.cxId": "context.authorizer.cxId",
          "integration.request.header.userId": "context.authorizer.userId",
        },
      },
      integrationHttpMethod: "ANY",
      uri: `http://${serverAddress}/{proxy}`,
    });
    tokenProxy.addMethod("ANY", integrationToken, {
      requestParameters: {
        "method.request.path.proxy": true,
      },
      authorizer,
    });
    return apiTokenResource;
  }

  private setupOAuthUserPool(): cognito.IUserPool {
    const userPool = new cognito.UserPool(this, "oauth-client-secret-user-pool", {
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    // TODO make this a custom domain
    userPool.addDomain("metriport-cognito-domain", {
      cognitoDomain: {
        domainPrefix: "metriport", // TODO make this dynamic/config
      },
    });
    return userPool;
  }

  private enableFHIROnUserPool(userPool: cognito.IUserPool): cognito.OAuthScope[] {
    const scopes = [
      {
        scopeName: "document",
        scopeDescription: "query and retrieve document references",
      },
    ];
    const resourceServerScopes = scopes.map(s => new cognito.ResourceServerScope(s));
    const resourceServer = userPool.addResourceServer("FHIR-resource-server", {
      identifier: "fhir",
      scopes: resourceServerScopes,
    });
    const oauthScopes = resourceServerScopes.map(s =>
      cognito.OAuthScope.resourceServer(resourceServer, s)
    );
    // Commonwell specific client
    userPool.addClient("commonwell-client", {
      generateSecret: true,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        flows: {
          clientCredentials: true,
        },
        scopes: oauthScopes,
      },
    });
    return oauthScopes;
  }

  private setupOAuthAuthorizer(userPool: cognito.IUserPool): apig.IAuthorizer {
    const cognitoAuthorizer = new apig.CognitoUserPoolsAuthorizer(this, `oauth-authorizer`, {
      cognitoUserPools: [userPool],
      identitySource: "method.request.header.Authorization",
    });
    return cognitoAuthorizer;
  }

  private setupAPIGWOAuthResource(
    stackId: string,
    api: apig.RestApi,
    vpcLink: apig.VpcLink,
    authorizer: apig.IAuthorizer,
    oauthScopes: cognito.OAuthScope[],
    serverAddress: string
  ): apig.Resource {
    const oauthResource = api.root.addResource("oauth", {
      defaultCorsPreflightOptions: { allowOrigins: ["*"] },
    });
    const oauthProxy = new apig.ProxyResource(this, `${stackId}/oauth/Proxy`, {
      parent: oauthResource,
      anyMethod: false,
      defaultCorsPreflightOptions: { allowOrigins: ["*"] },
    });
    const oauthProxyIntegration = new apig.Integration({
      type: apig.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apig.ConnectionType.VPC_LINK,
        vpcLink,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
        },
      },
      integrationHttpMethod: "ANY",
      uri: `http://${serverAddress}/oauth/{proxy}`,
    });
    oauthProxy.addMethod("ANY", oauthProxyIntegration, {
      requestParameters: {
        "method.request.path.proxy": true,
      },
      authorizer,
      authorizationScopes: oauthScopes.map(s => s.scopeName),
    });
    return oauthResource;
  }

  private addDBClusterPerformanceAlarms(dbCluster: rds.DatabaseCluster, dbClusterName: string) {
    const memoryMetric = dbCluster.metricFreeableMemory();
    memoryMetric.createAlarm(this, `${dbClusterName}FreeableMemoryAlarm`, {
      threshold: mbToBytes(150),
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    const storageMetric = dbCluster.metricFreeLocalStorage();
    storageMetric.createAlarm(this, `${dbClusterName}FreeLocalStorageAlarm`, {
      threshold: mbToBytes(250),
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    const cpuMetric = dbCluster.metricCPUUtilization();
    cpuMetric.createAlarm(this, `${dbClusterName}CPUUtilizationAlarm`, {
      threshold: 90, // pct
      evaluationPeriods: 1,
    });

    const readIOPsMetric = dbCluster.metricVolumeReadIOPs();
    readIOPsMetric.createAlarm(this, `${dbClusterName}VolumeReadIOPsAlarm`, {
      threshold: 20000, // IOPs per second
      evaluationPeriods: 1,
    });

    const writeIOPsMetric = dbCluster.metricVolumeWriteIOPs();
    writeIOPsMetric.createAlarm(this, `${dbClusterName}VolumeWriteIOPsAlarm`, {
      threshold: 5000, // IOPs per second
      evaluationPeriods: 1,
    });
  }

  private addDynamoPerformanceAlarms(table: dynamodb.Table, dynamoConstructName: string) {
    const readUnitsMetric = table.metricConsumedReadCapacityUnits();
    readUnitsMetric.createAlarm(this, `${dynamoConstructName}ConsumedReadCapacityUnitsAlarm`, {
      threshold: 10000, // units per second
      evaluationPeriods: 1,
    });

    const writeUnitsMetric = table.metricConsumedWriteCapacityUnits();
    writeUnitsMetric.createAlarm(this, `${dynamoConstructName}ConsumedWriteCapacityUnitsAlarm`, {
      threshold: 10000, // units per second
      evaluationPeriods: 1,
    });
  }

  private isProd(props: APIStackProps): boolean {
    return isProd(props.config);
  }
}
