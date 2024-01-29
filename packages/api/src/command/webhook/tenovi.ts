import { Biometrics, Body, ProviderSource, SourceType } from "@metriport/api-sdk";
import { formatNumber, getFloatValue } from "@metriport/shared/common/numbers";
import convert from "convert-units";
import { Product } from "../../domain/product";
import { TenoviMeasurement } from "../../mappings/tenovi";
import {
  updateBiometricsWithBloodGluc,
  updateBiometricsWithBP,
  updateBiometricsWithForcedExpVol,
  updateBiometricsWithHR,
  updateBiometricsWithPeakFlow,
  updateBiometricsWithPerfIndex,
  updateBiometricsWithSPO2,
  updateBiometricsWithTemperature,
} from "../../mappings/tenovi/biometrics";
import { TenoviMetricTypes, tenoviMetricTypes } from "../../mappings/tenovi/constants";
import { ConnectedUser } from "../../models/connected-user";
import { analytics, EventTypes } from "../../shared/analytics";
import { errorToString } from "../../shared/log";
import { capture } from "@metriport/core/util/capture";
import { getConnectedUsersByDeviceId } from "../connected-user/get-connected-user";
import { getSettingsOrFail } from "../settings/getSettings";
import {
  reportDevicesUsage,
  WebhookDataPayloadWithoutMessageId,
  WebhookUserDataPayload,
  WebhookUserPayload,
} from "./devices";
import { processRequest } from "./webhook";
import { createWebhookRequest } from "./webhook-request";

/**
 * Processes a Tenovi Measurement webhook, maps the data, and sends it to the CX
 *
 * @param data Tenovi Measurement webhook
 */
export const processMeasurementData = async (data: TenoviMeasurement): Promise<void> => {
  console.log(`Starting to process a Tenovi webhook: ${JSON.stringify(data)}`);

  try {
    const connectedUsers = await getConnectedUsersByDeviceId(
      ProviderSource.tenovi,
      data.hwi_device_id
    );

    const userData = mapData(data);
    if (userData) createAndSendPayload(connectedUsers, userData);
  } catch (error) {
    console.log(`Failed to process Tenovi WH - error: ${errorToString(error)}`);
    capture.error(error, {
      extra: { context: `webhook.processMeasurementData`, error, data },
    });
  }
};

/**
 * Maps the data from the webhook to Metriport schemas
 *
 * @param {TenoviMeasurement} data Patient data from a Tenovi webhook
 * @returns
 */
export function mapData(data: TenoviMeasurement): WebhookUserDataPayload | undefined {
  const payload: WebhookUserDataPayload = {};

  const { metric, device_name, hwi_device_id, value_1, value_2, created, timestamp } = data; // Available, but unused properties: sensor_code, timezone_offset, estimated_timestamp

  const numValue = getFloatValue(value_1);
  const numValue2 = value_2 ? getFloatValue(value_2) : undefined;

  const sourceInfo = { id: hwi_device_id, name: device_name, source_type: SourceType.device };
  const metadata = { date: created, source: ProviderSource.tenovi, data_source: sourceInfo };

  const biometrics: Biometrics = {
    metadata,
  };

  updateBiometricsWithBP(biometrics, metric, timestamp, numValue, numValue2);
  updateBiometricsWithHR(biometrics, metric, timestamp, numValue, numValue2);
  updateBiometricsWithSPO2(biometrics, metric, numValue, numValue2);
  updateBiometricsWithPerfIndex(biometrics, metric, numValue);
  updateBiometricsWithTemperature(biometrics, metric, timestamp, numValue);
  updateBiometricsWithBloodGluc(biometrics, metric, timestamp, numValue);
  updateBiometricsWithPeakFlow(biometrics, metric, numValue);
  updateBiometricsWithForcedExpVol(biometrics, metric, numValue);
  payload.biometrics = [biometrics];

  if (metric === "weight") {
    const body: Body = {
      metadata,
      weight_kg: formatNumber(convert(numValue).from("lb").to("kg")),
    };
    payload.body = [body];
  } else if (!tenoviMetricTypes.includes(metric as TenoviMetricTypes)) {
    const msg = `Tenovi webhook sent a new metric type`;
    console.log(`${msg} - ${metric}: ${JSON.stringify(data)}`);
    capture.message(msg, {
      extra: {
        content: `webhook.tenovi.mapData`,
        data,
        metric,
      },
      level: "warning",
    });
    return;
  }

  return payload;
}

/**
 * Creates and sends a webhook payload to the CX
 *
 * Called asynchronously, so it should treat errors w/o expecting it to be done upstream.
 *
 * @param user        Connected user
 * @param data        Patient mapped data
 */
async function createAndSendPayload(
  users: ConnectedUser[],
  data: WebhookUserDataPayload
): Promise<void> {
  await Promise.allSettled(
    users.map(async user => {
      const { id: userId, cxId } = user;
      const userData: WebhookUserPayload = { userId, ...data };
      const payload: WebhookDataPayloadWithoutMessageId = { users: [userData] };

      try {
        const webhookRequest = await createWebhookRequest({
          cxId,
          type: "devices.health-data",
          payload,
        });

        const settings = await getSettingsOrFail({ id: cxId });
        await processRequest(webhookRequest, settings);

        analytics({
          distinctId: cxId,
          event: EventTypes.query,
          properties: {
            method: "POST",
            url: "/webhook/tenovi",
          },
          apiType: Product.devices,
        });
        reportDevicesUsage(cxId, [userId]);
      } catch (error) {
        console.log(`Failed to send Tenovi WH - user: ${userId}, error: ${errorToString(error)}`);
        capture.error(error, {
          extra: { user, context: `webhook.createAndSendPayload`, error, data, userId },
        });
      }
    })
  );
}
