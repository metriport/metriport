import { doesHieUseVpn } from "@metriport/core/command/hl7v2-subscriptions/types";
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { EnvConfig } from "../config/env-config";
import { APIStack } from "../lib/api-stack";
import { AuditLogStack } from "../lib/audit-log/audit-log-stack";
import { BucketsStack } from "../lib/buckets-stack";
import { ConnectWidgetStack } from "../lib/connect-widget-stack";
import { EhexStack } from "../lib/ehex-stack";
import { Hl7NotificationStack } from "../lib/hl7-notification-stack";
import { VpnStack } from "../lib/hl7-notification-stack/vpn";
import { IHEStack } from "../lib/ihe-stack";
import { LocationServicesStack } from "../lib/location-services-stack";
import { SecretsStack } from "../lib/secrets-stack";
import { initConfig } from "../lib/shared/config";
import { getEnvVar, isSandbox } from "../lib/shared/util";

const app = new cdk.App();

//-------------------------------------------
// Deploy the corresponding stacks
//-------------------------------------------
async function deploy(config: EnvConfig) {
  // CDK_DEFAULT_ACCOUNT will come from your AWS CLI account profile you've setup.
  // To specify a different profile, you can use the profile flag. For example:
  //    cdk synth --profile prod-profile
  const env = {
    account: getEnvVar("CDK_DEFAULT_ACCOUNT"),
    region: config.region,
  };
  const version = getEnvVar("METRIPORT_VERSION");

  //---------------------------------------------------------------------------------
  // Do this first, and then manually set the values in the AWS Secrets Manager.
  //---------------------------------------------------------------------------------
  new SecretsStack(app, config.secretsStackName, { env, config });

  new BucketsStack(app, "BucketsStack", { env, config });

  new AuditLogStack(app, "AuditLogStack", { env, config });

  if (config.locationService) {
    new LocationServicesStack(app, config.locationService.stackName, {
      env: { ...env, region: config.locationService.placeIndexRegion },
      config,
    });
  }

  new APIStack(app, config.stackName, { env, config, version });

  if (!isSandbox(config)) {
    const hl7NotificationStack = new Hl7NotificationStack(app, "Hl7NotificationStack", {
      env,
      config,
      version,
    });

    Object.values(config.hl7Notification.hieConfigs).forEach((hieConfig, index) => {
      // We only create VPN stacks for full HieConfig objects (not `VpnlessHieConfig`s)
      if (!doesHieUseVpn(hieConfig)) {
        return;
      }

      const vpnStack = new VpnStack(app, `VpnStack-${hieConfig.name}`, {
        hieConfig,
        index,
        networkStackId: "NestedNetworkStack",
        description: `VPN Configuration for routing HL7 messages from ${hieConfig.name}`,
      });

      vpnStack.addDependency(hl7NotificationStack);
    });
  }

  if (config.iheGateway) {
    new IHEStack(app, "IHEStack", {
      env,
      config: config,
      version,
    });
  }

  if (config.ehexGateway) {
    new EhexStack(app, "EhexStack", {
      env,
      config,
      version,
    });
  }

  if (!isSandbox(config)) {
    new ConnectWidgetStack(app, config.connectWidget.stackName, {
      env: { ...env, region: config.connectWidget.region },
      config: { ...config, connectWidget: config.connectWidget },
    });
  }

  //---------------------------------------------------------------------------------
  // Execute the updates on AWS
  //---------------------------------------------------------------------------------
  app.synth();
}

initConfig(app.node).then(config => deploy(config));
