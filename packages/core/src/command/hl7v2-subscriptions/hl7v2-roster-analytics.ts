import { InternalOrganizationDTO } from "@metriport/shared/domain/organization";
import { Patient } from "../../domain/patient";
import { analyticsAsync, EventTypes } from "../../external/analytics/posthog";
import { reportMetric } from "../../external/aws/cloudwatch";
import { Config } from "../../util/config";
import _ from "lodash";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";

export async function trackRosterSizePerCustomer(
  patients: Patient[],
  hieName: string,
  orgsByCxId: Record<string, InternalOrganizationDTO>,
  rosterSize: number,
  log: typeof console.log
): Promise<void> {
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

    try {
      await Promise.all([
        notifyPostHogPerCustomer(cxId, cxName, customerRosterSize, hieName, posthogSecret),
        notifyCloudWatchPerCustomer(cxId, cxName, customerRosterSize, hieName),
      ]);
      log(`Sent analytics for customer ${cxId}: ${customerRosterSize} patients in ${hieName}`);
    } catch (error) {
      log(`Failed to send analytics for customer ${cxId}: ${error}`);
    }
  }

  // Maybe throw error here?
  if (totalRosterSize !== rosterSize) {
    log(
      `WARNING: Total roster size sent partitioned by cxs (${totalRosterSize}) does not match the actual roster size sent to the HIE (${rosterSize})!!`
    );
  }
}

async function notifyPostHogPerCustomer(
  cxId: string,
  cxName: string,
  rosterSize: number,
  hieName: string,
  posthogSecret: string
): Promise<void> {
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

async function notifyCloudWatchPerCustomer(
  cxId: string,
  cxName: string,
  rosterSize: number,
  hieName: string
): Promise<void> {
  const additional = `Hie=${hieName},Customer=${cxId},CustomerName=${cxName}`;

  await reportMetric({
    name: "ADT.RosterUpload.CustomerRosterSize",
    unit: "Count",
    value: rosterSize,
    additionalDimension: additional,
  });
}
