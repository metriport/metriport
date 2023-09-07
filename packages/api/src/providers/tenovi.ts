/* eslint-disable @typescript-eslint/no-unused-vars */
import { Biometrics, Body } from "@metriport/api-sdk";
import axios from "axios";
import dayjs from "dayjs";
import { TenoviMeasurementData, tenoviMeasurementDataSchema } from "../mappings/tenovi";
import { mapToBiometrics } from "../mappings/tenovi/biometrics";
import { mapToBody } from "../mappings/tenovi/body";
import { ConnectedUser } from "../models/connected-user";
import Provider, { ConsumerHealthDataType, DAPIParams } from "./provider";
import { updateProviderData } from "../command/connected-user/save-connected-user";
import { PROVIDER_TENOVI } from "../shared/constants";
import { capture } from "../shared/notifications";
import stringify from "json-stringify-safe";
import MetriportError from "../errors/metriport-error";

export const TENOVI_DEFAULT_TOKEN_VALUE = "N/A";
const TENOVI_TEST_DEVICE_ID = "12345678-abcd-1234-abcd-1234567890ab";

export class Tenovi extends Provider {
  static URL = "https://api2.tenovi.com";
  static API_PATH = "clients";

  constructor() {
    super({
      // All disabled for synchronous mode
      [ConsumerHealthDataType.Activity]: false,
      [ConsumerHealthDataType.Body]: true,
      [ConsumerHealthDataType.Biometrics]: true,
      [ConsumerHealthDataType.Nutrition]: false,
      [ConsumerHealthDataType.Sleep]: false,
      [ConsumerHealthDataType.User]: false,
    });
  }

  /**
   * Disconnects all connected devices from the user's Tenovi Gateway.
   * Removes Tenovi from the user's ProviderMap.
   *
   * @param connectedUser The user to disconnect the device from
   */
  async revokeProviderAccess(connectedUser: ConnectedUser, extraParams: DAPIParams): Promise<void> {
    const connectedDevices = connectedUser.providerMap?.tenovi?.connectedDeviceIds;
    if (connectedDevices && connectedDevices.length) {
      const res = await Promise.allSettled(
        connectedDevices.map(async deviceId => {
          await this.disconnectDevice(connectedUser, deviceId, false, extraParams);
        })
      );

      const rejected = res.filter(r => r.status === "rejected");
      if (rejected.length) {
        throw new MetriportError(`Failed to disconnect device(s) from Tenovi Gateway.`, undefined, {
          numberOfDevices: rejected.length.toString(),
          user: connectedUser.dataValues.id,
        });
      }
      try {
        await updateProviderData({
          id: connectedUser.id,
          cxId: connectedUser.cxId,
          provider: PROVIDER_TENOVI,
          providerItem: undefined,
        });
      } catch (err) {
        console.log("Failed to remove Tenovi from ProviderMap", stringify(err));
        capture.error(err, {
          extra: { context: "tenovi.revokeProviderAccess", err, user: connectedUser.dataValues },
        });
        throw err;
      }
    }
  }

  /**
   * Disconnects the device from the user's Tenovi Gateway.
   * Optionally updates the user's connected devices list.
   *
   * @param connectedUser The user to disconnect the device from
   * @param deviceId      The device to disconnect
   * @param updateUser    Whether to update the user's connected devices list
   */
  async disconnectDevice(
    connectedUser: ConnectedUser,
    deviceId: string,
    updateUser: boolean,
    extraParams: DAPIParams
  ): Promise<void> {
    const connectedDevices = connectedUser.providerMap?.tenovi?.connectedDeviceIds;
    const { xTenoviApiKey, xTenoviClientName } = extraParams;

    if (connectedDevices && connectedDevices.includes(deviceId)) {
      const url = `${Tenovi.URL}/${Tenovi.API_PATH}/${xTenoviClientName}/hwi/unlink-gateway/${deviceId}/`;

      try {
        if (deviceId !== TENOVI_TEST_DEVICE_ID) {
          await axios.get(url, {
            headers: {
              Authorization: `Api-Key ${xTenoviApiKey}`,
            },
          });
        }

        if (updateUser) {
          const index = connectedDevices.indexOf(deviceId);
          if (index !== -1) {
            connectedDevices.splice(index, 1);
          }

          await updateProviderData({
            id: connectedUser.id,
            cxId: connectedUser.cxId,
            provider: PROVIDER_TENOVI,
            providerItem: {
              token: TENOVI_DEFAULT_TOKEN_VALUE,
              connectedDeviceIds: connectedDevices,
              deviceUserId: connectedUser.providerMap?.tenovi?.deviceUserId,
            },
          });
        }
      } catch (err) {
        console.log("Failed to disconnect devices from Tenovi Gateway", stringify(err));
        capture.error(err, {
          extra: {
            context: "tenovi.revokeProviderAccess",
            err,
            user: connectedUser.dataValues,
            cxName: xTenoviClientName,
          },
        });
        throw err;
      }
    } else {
      capture.message(`Device ID not found for this user.`, {
        extra: {
          context: "tenovi.disconnectDevice",
          deviceId,
          connectedDevices,
          user: connectedUser.dataValues,
          level: "info",
          cxName: xTenoviClientName,
        },
      });
      throw new Error(`Device ${deviceId} not found for this user.`);
    }
  }

  async fetchPatientData(url: string, xTenoviApiKey: string): Promise<TenoviMeasurementData> {
    const resp = await axios.get(url, {
      headers: {
        Authorization: `Api-Key ${xTenoviApiKey}`,
      },
    });
    return tenoviMeasurementDataSchema.parse(resp.data);
  }

  override async getBodyData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Body> {
    const startDate = dayjs(date).toISOString();
    const endDate = dayjs(date).add(1, "day").toISOString();

    const { xTenoviApiKey, xTenoviClientName } = extraParams;
    if (!xTenoviApiKey) throw new Error("Missing x-tenovi-api-key header.");
    if (!xTenoviClientName) throw new Error("Missing x-tenovi-client header.");

    const patientId = connectedUser.providerMap?.tenovi?.deviceUserId;

    const patientMeasUrl = `${Tenovi.URL}/${Tenovi.API_PATH}/${xTenoviClientName}/hwi/patients/${patientId}/measurements/?metric__name=weight&timestamp__gte=${startDate}&timestamp__lt=${endDate}`;
    const weightData = await this.fetchPatientData(patientMeasUrl, xTenoviApiKey);

    return mapToBody(date, weightData);
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Biometrics> {
    const { xTenoviApiKey, xTenoviClientName } = extraParams;
    if (!xTenoviApiKey) throw new Error("Missing x-tenovi-api-key header.");
    if (!xTenoviClientName) throw new Error("Missing x-tenovi-client header.");

    const startDate = dayjs(date).toISOString();
    const endDate = dayjs(date).add(1, "day").toISOString();

    const patientId = connectedUser.providerMap?.tenovi?.deviceUserId;

    const patientMeasUrl = `${Tenovi.URL}/${Tenovi.API_PATH}/${xTenoviClientName}/hwi/patients/${patientId}/measurements/?timestamp__gte=${startDate}&timestamp__lt=${endDate}`;
    const patientBiometricsData = await this.fetchPatientData(patientMeasUrl, xTenoviApiKey);

    return mapToBiometrics(date, patientBiometricsData);
  }
}
