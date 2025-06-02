import { NestedStack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { LambdaLayers, setupLambdasLayers } from "./shared/lambda-layers";

export class LambdasLayersNestedStack extends NestedStack {
  readonly lambdaLayers: LambdaLayers;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.terminationProtection = true;

    this.lambdaLayers = setupLambdasLayers(this);
  }
}
