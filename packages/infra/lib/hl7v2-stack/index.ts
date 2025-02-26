import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { MetriportCompositeStack } from "../shared/metriport-composite-stack";
import { Hl7v2ApplicationStack } from "./application";
import { Hl7v2NetworkStack } from "./network";
import { VpnStack } from "./vpn";

export interface Hl7v2CompositeStackProps extends cdk.StackProps {
  config: EnvConfig;
  version: string | undefined;
}

export class Hl7v2CompositeStack extends MetriportCompositeStack {
  public readonly networkStack: Hl7v2NetworkStack;
  public readonly applicationStack: Hl7v2ApplicationStack;

  constructor(scope: Construct, id: string, props: Hl7v2CompositeStackProps) {
    super(scope, id, props);

    // 1. Create the HL7v2 network stack.
    this.networkStack = new Hl7v2NetworkStack(this, "Hl7v2NetworkStack", {
      stackName: "Hl7v2NetworkStack",
      config: props.config,
      description: "HL7v2 Network Infrastructure",
    });

    // 2. Create the HL7v2 application stack
    this.applicationStack = new Hl7v2ApplicationStack(this, "Hl7v2ApplicationStack", {
      stackName: "Hl7v2ApplicationStack",
      config: props.config,
      version: props.version,
      networkStack: this.networkStack.output,
      description: "HL7v2 Application Infrastructure",
    });

    // 3. Create VPN stacks for each customer.
    props.config.hl7v2.vpnConfigs.forEach(vpnConfig => {
      new VpnStack(this, `Hl7v2VpnStack${vpnConfig.customerName}`, {
        vpc: this.networkStack.output.vpc,
        vpnConfig,
        description: `VPN Configuration for ${vpnConfig.customerName}`,
      });
    });
  }
}
