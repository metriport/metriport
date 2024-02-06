import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";

export class IHEPrereqStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Create an ECR repo where we'll deploy our Docker images to, and where ECS will pull from
    const ecrRepo = new ecr.Repository(this, "IHE-GW-ECR-Repo", {
      repositoryName: "metriport/ihe-gateway",
    });
    new CfnOutput(this, "IHE-GW-ECR-Repo-URI", {
      description: "IGE Gateway ECR repository URI",
      value: ecrRepo.repositoryUri,
    });
  }
}
