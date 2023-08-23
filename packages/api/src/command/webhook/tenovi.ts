import { Biometrics, Body, ProviderSource, SourceType } from "@metriport/api-sdk";
import convert from "convert-units";
import { TenoviMeasurement } from "../../mappings/tenovi";
import {
  map_blood_gluc,
  map_bp,
  map_forced_exp_vol,
  map_hr,
  map_peak_flow,
  map_perf_index,
  map_spo2,
  map_temp,
} from "../../mappings/tenovi/biometrics";
import { tenoviMetricTypes } from "../../mappings/tenovi/constants";
import { ConnectedUser } from "../../models/connected-user";
import { EventTypes, analytics } from "../../shared/analytics";
import { capture } from "../../shared/notifications";
import { formatNumber, getFloatValue } from "../../shared/numbers";
import { getConnectedUserByDeviceId } from "../connected-user/get-connected-user";
import { getSettingsOrFail } from "../settings/getSettings";
import { ApiTypes } from "../usage/report-usage";
import { reportDevicesUsage } from "./devices";
import {
  WebhookDataPayloadWithoutMessageId,
  WebhookUserDataPayload,
  WebhookUserPayload,
  processRequest,
} from "./webhook";
import { createWebhookRequest } from "./webhook-request";

/**
 * Processes a Tenovi Measurement webhook
 *
 * @param data Tenovi Measurement webhook
 */
export const processMeasurementData = async (data: TenoviMeasurement): Promise<void> => {
  console.log(`Starting to process a Tenovi webhook: ${JSON.stringify(data)}`);

  const connectedUser = await getConnectedUserByDeviceId(ProviderSource.tenovi, data.hwi_device_id);

  const userData = mapData(data);
  createAndSendPayload(connectedUser, userData, data.patient_id);
};

/**
 * Maps the data from the webhook to Metriport schemas
 *
 * @param {TenoviMeasurement} data Patient data from a Tenovi webhook
 * @returns
 */
export function mapData(data: TenoviMeasurement): WebhookUserDataPayload {
  const payload: WebhookUserDataPayload = {};

  const { metric, device_name, hwi_device_id, value_1, value_2, created, timestamp } = data; // Available, but unused properties: sensor_code, timezone_offset, estimated_timestamp

  const num_value_1 = getFloatValue(value_1);
  const num_value_2 = value_2 ? getFloatValue(value_2) : undefined;

  const sourceInfo = { id: hwi_device_id, name: device_name, source_type: SourceType.device };
  const metadata = { date: created, source: ProviderSource.tenovi, data_source: sourceInfo };

  const biometrics: Biometrics = {
    metadata,
  };

  map_bp(biometrics, metric, timestamp, num_value_1, num_value_2);
  map_hr(biometrics, metric, timestamp, num_value_1, num_value_2);
  map_spo2(biometrics, metric, num_value_1, num_value_2);
  map_perf_index(biometrics, metric, num_value_1);
  map_temp(biometrics, metric, timestamp, num_value_1);
  map_blood_gluc(biometrics, metric, timestamp, num_value_1);
  map_peak_flow(biometrics, metric, num_value_1);
  map_forced_exp_vol(biometrics, metric, num_value_1);

  if (metric === "weight") {
    const body: Body = {
      metadata,
      weight_kg: formatNumber(convert(num_value_1).from("lb").to("kg")),
    };
    payload.body = [body];
  } else if (!tenoviMetricTypes.includes(metric)) {
    capture.message(`Tenovi webhook sent a new metric type`, {
      extra: {
        content: `webhook.tenovi.mapData`,
        data,
        metric,
      },
    });
  }

  payload.biometrics = [biometrics];

  return payload;
}

/**
 * Creates and sends a webhook payload to the CX
 *
 * @param user        Connected user
 * @param data        Patient mapped data
 * @param patient_id  Patient ID
 */
async function createAndSendPayload(
  user: ConnectedUser,
  data: WebhookUserDataPayload,
  patient_id: string
): Promise<void> {
  const { id: userId, cxId } = user;
  const userData: WebhookUserPayload = { userId, ...data, patient_id };
  const payload: WebhookDataPayloadWithoutMessageId = { users: [userData] };

  analytics({
    distinctId: cxId,
    event: EventTypes.query,
    properties: {
      method: "POST",
      url: "/webhook/tenovi",
      apiType: ApiTypes.devices,
    },
  });
  const webhookRequest = await createWebhookRequest({
    cxId,
    type: "devices.health-data",
    payload,
  });

  const settings = await getSettingsOrFail({ id: cxId });
  await processRequest(webhookRequest, settings);

  reportDevicesUsage(cxId, [userId]);
}
