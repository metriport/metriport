import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { createDocQueryChecker } from "./api-stack/doc-query-checker";
import { createJobsScheduler } from "./jobs/jobs-scheduler";
import {
  createDownloadResponseScheduledLambda as createQuestDownloadResponseScheduledLambda,
  createUploadRosterScheduledLambdaBackfill as createQuestUploadRosterScheduledLambdaBackfill,
  createUploadRosterScheduledLambdaNotifications as createQuestUploadRosterScheduledLambdaNotifications,
} from "./quest/scheduled-lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import {
  createReceiveAllScheduledLambda as createSurescriptsReceiveAllScheduledLambda,
  createUploadRosterScheduledLambdaBackfill as createSurescriptsUploadRosterScheduledLambdaBackfill,
} from "./surescripts/scheduled-lambda";
import { createScheduledAPIQuotaChecker } from "./api-stack/api-quota-checker";
import { createScheduledDBMaintenance } from "./api-stack/db-maintenance";
import { createPatientMonitoringScheduledQueriesScheduler } from "./patient-monitoring/scheduled-lambda";
import { createRawToCoreScheduledLambdaNotifications } from "./analytics-platform/scheduled-lambda";

interface ScheduledLambdasNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alertAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  apiDirectUrl: string;
}

export class ScheduledLambdasNestedStack extends NestedStack {
  constructor(scope: Construct, id: string, props: ScheduledLambdasNestedStackProps) {
    super(scope, id, props);

    const { lambdaLayers, vpc, apiDirectUrl, alertAction } = props;

    this.terminationProtection = true;

    createDocQueryChecker({
      lambdaLayers,
      stack: this,
      vpc,
      apiAddress: apiDirectUrl,
      alertSnsAction: alertAction,
    });

    createJobsScheduler({
      lambdaLayers,
      stack: this,
      vpc,
      apiAddress: apiDirectUrl,
      alertSnsAction: alertAction,
    });

    createScheduledAPIQuotaChecker({
      stack: this,
      lambdaLayers,
      vpc,
      apiAddress: apiDirectUrl,
      alertSnsAction: alertAction,
    });

    createScheduledDBMaintenance({
      stack: this,
      lambdaLayers,
      vpc,
      apiAddress: apiDirectUrl,
      alertSnsAction: alertAction,
    });

    createPatientMonitoringScheduledQueriesScheduler({
      lambdaLayers,
      stack: this,
      vpc,
      apiAddress: apiDirectUrl,
      alertSnsAction: alertAction,
    });

    if (props.config.quest) {
      createQuestUploadRosterScheduledLambdaBackfill({
        lambdaLayers,
        stack: this,
        vpc,
        apiAddress: apiDirectUrl,
        alertSnsAction: alertAction,
      });

      createQuestUploadRosterScheduledLambdaNotifications({
        lambdaLayers,
        stack: this,
        vpc,
        apiAddress: apiDirectUrl,
        alertSnsAction: alertAction,
      });

      createQuestDownloadResponseScheduledLambda({
        lambdaLayers,
        stack: this,
        vpc,
        apiAddress: apiDirectUrl,
        alertSnsAction: alertAction,
      });
    }

    if (props.config.surescripts) {
      createSurescriptsUploadRosterScheduledLambdaBackfill({
        lambdaLayers,
        stack: this,
        vpc,
        apiAddress: apiDirectUrl,
        alertSnsAction: alertAction,
      });

      createSurescriptsReceiveAllScheduledLambda({
        lambdaLayers,
        stack: this,
        vpc,
        apiAddress: apiDirectUrl,
        alertSnsAction: alertAction,
      });

      createRawToCoreScheduledLambdaNotifications({
        lambdaLayers,
        stack: this,
        vpc,
        apiAddress: apiDirectUrl,
        alarmSnsAction: alertAction,
      });
    }
  }
}
