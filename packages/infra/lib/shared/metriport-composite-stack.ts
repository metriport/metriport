import * as cdk from "aws-cdk-lib";
import { CfnElement } from "aws-cdk-lib";
import { Construct } from "constructs";

export class MetriportCompositeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }

  /**
   * Override to ensure nested stack resources are readable in AWS Console.
   */
  public override getLogicalId(element: CfnElement): string {
    if (element.node.id.includes("NestedStackResource")) {
      const match = /([a-zA-Z0-9_-]+)\.NestedStackResource/.exec(element.node.id);
      if (match && match[1]) {
        return match[1];
      }
    }

    return super.getLogicalId(element);
  }
}
