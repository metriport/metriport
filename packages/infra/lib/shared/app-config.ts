import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export function allowReadConfig({
  scope,
  resourceRole,
  appConfigResources,
  resourceName,
}: {
  scope: Construct;
  resourceRole: iam.IRole | undefined;
  appConfigResources: string[];
  resourceName: string;
}) {
  resourceRole?.attachInlinePolicy(
    new iam.Policy(scope, `${resourceName}PermissionsForAppConfig`, {
      statements: [
        new iam.PolicyStatement({
          actions: [
            "appconfig:StartConfigurationSession",
            "appconfig:GetLatestConfiguration",
            "appconfig:GetConfiguration",
          ],
          resources: appConfigResources,
        }),
      ],
    })
  );
}
