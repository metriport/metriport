import { InternalOrganizationDTO } from "@metriport/shared/domain/organization";
import { Patient } from "../../domain/patient";
import { analyticsAsync, EventTypes } from "../../external/analytics/posthog";
import { reportMetric } from "../../external/aws/cloudwatch";
import { Config } from "../../util/config";
import _ from "lodash";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";

export type TrackRosterSizePerCustomerParams = {
  rosterSize: number;
  hieName: string;
  log: typeof console.log;
  patients: Patient[];
  orgsByCxId: Record<string, InternalOrganizationDTO>;
};

type notifyPostHogPerCustomerParams = {
  cxId: string;
  cxName: string;
  rosterSize: number;
  hieName: string;
  posthogSecret: string;
};

type notifyCloudWatchPerCustomerParams = {
  cxId: string;
  cxName: string;
  rosterSize: number;
  hieName: string;
};

export async function trackRosterSizePerCustomer({
  rosterSize,
  hieName,
  log,
  patients,
  orgsByCxId,
}: TrackRosterSizePerCustomerParams): Promise<void> {
  log("Tracking roster size per customer per HIE");

  const posthogSecretArn = Config.getPostHogApiKey();
  if (!posthogSecretArn) {
    throw new Error("Failed to get posthog secret");
  }
  const posthogSecret = await getSecretValueOrFail(posthogSecretArn, Config.getAWSRegion());

  const patientsByCustomer = _.groupBy(patients, "cxId");
  let totalRosterSize = 0;
  for (const [cxId, customerPatients] of Object.entries(patientsByCustomer)) {
    const cx = orgsByCxId[cxId];
    if (!cx) {
      log(`Customer ${cxId} has no name, skipping`);
      continue;
    }

    const cxName = cx.name;

    totalRosterSize += customerPatients.length;
    const customerRosterSize = customerPatients.length;

    const posthogParams: notifyPostHogPerCustomerParams = {
      cxId,
      cxName,
      rosterSize: customerRosterSize,
      hieName,
      posthogSecret,
    };

    const cloudwatchParams: notifyCloudWatchPerCustomerParams = {
      cxId,
      cxName,
      rosterSize: customerRosterSize,
      hieName,
    };

    try {
      await Promise.all([
        notifyPostHogPerCustomer(posthogParams),
        notifyCloudWatchPerCustomer(cloudwatchParams),
      ]);
      log(`Sent analytics for customer ${cxId}: ${customerRosterSize} patients in ${hieName}`);
    } catch (error) {
      log(`Failed to send analytics for customer ${cxId}: ${error}`);
    }
  }

  if (totalRosterSize !== rosterSize) {
    throw new Error(
      `WARNING: Total roster size sent partitioned by cxs (${totalRosterSize}) does not match the actual roster size sent to the HIE (${rosterSize})!!`
    );
  }
}

async function notifyPostHogPerCustomer({
  cxId,
  cxName,
  rosterSize,
  hieName,
  posthogSecret,
}: notifyPostHogPerCustomerParams): Promise<void> {
  await analyticsAsync(
    {
      event: EventTypes.rosterUploadPerCustomer,
      distinctId: cxId,
      properties: {
        customerId: cxId,
        customerName: cxName,
        stateHie: hieName,
        rosterSize: rosterSize,
      },
    },
    posthogSecret
  );
}

async function notifyCloudWatchPerCustomer({
  cxId,
  cxName,
  rosterSize,
  hieName,
}: notifyCloudWatchPerCustomerParams): Promise<void> {
  const additional = `Hie=${hieName},Customer=${cxId},CustomerName=${cxName}`;

  await reportMetric({
    name: "ADT.RosterUpload.CustomerRosterSize",
    unit: "Count",
    value: rosterSize,
    additionalDimension: additional,
  });
}
