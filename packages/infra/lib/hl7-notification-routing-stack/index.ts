import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { MetriportCompositeStack } from "../shared/metriport-composite-stack";
import { MllpStack } from "./mllp";
import { NetworkStack } from "./network";
import { VpnStack } from "./vpn";

export interface Hl7NotificationRoutingStackProps extends cdk.StackProps {
  config: EnvConfig;
  version: string | undefined;
}

export class Hl7NotificationRoutingStack extends MetriportCompositeStack {
  public readonly networkStack: NetworkStack;
  public readonly mllpStack: MllpStack;

  constructor(scope: Construct, id: string, props: Hl7NotificationRoutingStackProps) {
    super(scope, id, props);

    this.networkStack = new NetworkStack(this, "NetworkStack", {
      stackName: "NetworkStack",
      config: props.config,
      description: "HL7 Notification Routing Network Infrastructure",
    });

    this.mllpStack = new MllpStack(this, "MllpStack", {
      stackName: "MllpStack",
      config: props.config,
      version: props.version,
      networkStack: this.networkStack.output,
      description: "HL7 Notification Routing MLLP Infrastructure",
    });

    props.config.hl7NotificationRouting.vpnConfigs.forEach(hieSpecificConfig => {
      new VpnStack(this, `VpnStack${hieSpecificConfig.partnerName}`, {
        vpc: this.networkStack.output.vpc,
        vpnConfig: hieSpecificConfig,
        description: `VPN Configuration for routing HL7 messages from ${hieSpecificConfig.partnerName}`,
      });
    });
  }
}
