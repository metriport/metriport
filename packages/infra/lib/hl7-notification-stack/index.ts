import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { MetriportCompositeStack } from "../shared/metriport-composite-stack";
import { MllpStack } from "./mllp";
import { NetworkStack } from "./network";
import { VpnStack } from "./vpn";

export interface Hl7NotificationStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
}

export class Hl7NotificationStack extends MetriportCompositeStack {
  public readonly networkStack: NetworkStack;
  public readonly mllpStack: MllpStack;

  constructor(scope: Construct, id: string, props: Hl7NotificationStackProps) {
    super(scope, id, props);

    this.networkStack = new NetworkStack(this, "NestedNetworkStack", {
      stackName: "NestedNetworkStack",
      config: props.config,
      description: "HL7 Notification Network Infrastructure",
    });

    this.mllpStack = new MllpStack(this, "NestedMllpStack", {
      stackName: "NestedMllpStack",
      config: props.config,
      version: props.version,
      networkStack: this.networkStack.output,
      description: "HL7 Notification MLLP Server",
    });

    props.config.hl7Notification.vpnConfigs.forEach(hieSpecificConfig => {
      new VpnStack(this, `NestedVpnStack${hieSpecificConfig.partnerName}`, {
        vpc: this.networkStack.output.vpc,
        vpnConfig: hieSpecificConfig,
        description: `VPN Configuration for routing HL7 messages from ${hieSpecificConfig.partnerName}`,
      });
    });
  }
}
