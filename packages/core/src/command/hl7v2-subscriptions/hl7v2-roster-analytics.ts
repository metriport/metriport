import { InternalOrganizationDTO } from "@metriport/shared/domain/organization";
import _ from "lodash";
import { Patient } from "../../domain/patient";
import { analyticsAsync, EventTypes } from "../../external/analytics/posthog";
import { reportAdvancedMetrics } from "../../external/aws/cloudwatch";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";
import { Config } from "../../util/config";
import { capture } from "../../util/notifications";

export type TrackRosterSizePerCustomerParams = {
  rosterSize: number;
  hieName: string;
  log: typeof console.log;
  patients: Patient[];
  orgsByCxId: Record<string, InternalOrganizationDTO>;
};

export async function trackRosterSizePerCustomer({
  rosterSize,
  hieName,
  log,
  patients,
  orgsByCxId,
}: TrackRosterSizePerCustomerParams): Promise<void> {
  log("Tracking roster size per customer per HIE");

  if (rosterSize === 0) {
    capture.error(
      new Error(
        `Roster size is 0 for ${hieName}. This may occur if we are still setting up the integration. Ask in slack if this is expected.`
      ),
      {
        extra: {
          rosterSize,
          hieName,
        },
      }
    );
  }

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
        analyticsAsync(
          {
            event: EventTypes.rosterUploadPerCustomer,
            distinctId: cxId,
            properties: {
              customerId: cxId,
              customerName: cxName,
              stateHie: hieName,
              rosterSize: customerRosterSize,
            },
          },
          posthogSecret
        ),
        reportAdvancedMetrics({
          service: "Hl7v2RosterGenerator",
          metrics: [
            {
              name: "ADT.RosterUpload.CustomerRosterSize",
              unit: "Count",
              value: customerRosterSize,
              dimensions: {
                Hie: hieName,
                Customer: cxId,
                CustomerName: cxName,
              },
            },
          ],
        }),
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
