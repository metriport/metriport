/* eslint-disable @typescript-eslint/no-unused-vars */
import { Biometrics, Body } from "@metriport/api-sdk";
import axios from "axios";
import dayjs from "dayjs";
import { TenoviMeasurementData, tenoviMeasurementDataSchema } from "../mappings/tenovi";
import { mapToBiometrics } from "../mappings/tenovi/biometrics";
import { mapToBody } from "../mappings/tenovi/body";
import { ConnectedUser } from "../models/connected-user";
import { Config } from "../shared/config";
import Provider, { ConsumerHealthDataType, DAPIParams } from "./provider";
import { updateProviderData } from "../command/connected-user/save-connected-user";
import { PROVIDER_TENOVI } from "../shared/constants";
import { capture } from "../shared/notifications";
import stringify from "json-stringify-safe";

export class Tenovi extends Provider {
  static URL = "https://api2.tenovi.com";
  static API_PATH = "clients/metriport";

  private static apiKey = Config.getTenoviApiKey();

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
  async revokeProviderAccess(connectedUser: ConnectedUser): Promise<void> {
    if (connectedUser.providerMap?.tenovi?.connectedDeviceIds) {
      const res = await Promise.allSettled(
        connectedUser.providerMap?.tenovi?.connectedDeviceIds?.map(async deviceId => {
          await this.disconnectDevice(connectedUser, deviceId, false);
        })
      );

      const rejected = res.filter(r => r.status === "rejected");
      if (rejected.length) {
        throw new Error(
          `Failed to disconnect ${rejected.length} devices from Tenovi Gateway. User: ${connectedUser.id}`
        );
      } else {
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
    updateUser = true
  ): Promise<void> {
    const connectedDevices = connectedUser.providerMap?.tenovi?.connectedDeviceIds;
    if (connectedDevices && connectedDevices.includes(deviceId)) {
      const url = `${Tenovi.URL}/${Tenovi.API_PATH}/hwi/unlink-gateway/${deviceId}/`;

      try {
        await axios.get(url, {
          headers: {
            Authorization: `Api-Key ${Tenovi.apiKey}`,
          },
        });

        if (updateUser) {
          const connectedDevices = connectedUser.providerMap?.tenovi?.connectedDeviceIds;
          const index = connectedDevices?.indexOf(deviceId);
          if (index !== undefined && index !== -1) {
            connectedDevices?.splice(index, 1);
          }

          await updateProviderData({
            id: connectedUser.id,
            cxId: connectedUser.cxId,
            provider: PROVIDER_TENOVI,
            providerItem: {
              token: "N/A",
              connectedDeviceIds: connectedDevices,
              deviceUserId: connectedUser.providerMap?.tenovi?.deviceUserId,
            },
          });
        }
      } catch (err) {
        console.log("Failed to disconnect devices from Tenovi Gateway", stringify(err));
        capture.error(err, {
          extra: { context: "tenovi.revokeProviderAccess", err, user: connectedUser.dataValues },
        });
        throw err;
      }
    }
  }

  async fetchPatientData(url: string): Promise<TenoviMeasurementData> {
    const resp = await axios.get(url, {
      headers: {
        Authorization: `Api-Key ${Tenovi.apiKey}`,
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

    const patientId = connectedUser.providerMap?.tenovi?.deviceUserId;

    const patientMeasUrl = `${Tenovi.URL}/${Tenovi.API_PATH}/hwi/patients/${patientId}/measurements/?metric__name=weight&timestamp__gte=${startDate}&timestamp__lt=${endDate}`;
    const weightData = await this.fetchPatientData(patientMeasUrl);

    return mapToBody(date, weightData);
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Biometrics> {
    const startDate = dayjs(date).toISOString();
    const endDate = dayjs(date).add(1, "day").toISOString();

    const patientId = connectedUser.providerMap?.tenovi?.deviceUserId;

    const patientMeasUrl = `${Tenovi.URL}/${Tenovi.API_PATH}/hwi/patients/${patientId}/measurements/?timestamp__gte=${startDate}&timestamp__lt=${endDate}`;
    const patientBiometricsData = await this.fetchPatientData(patientMeasUrl);

    return mapToBiometrics(date, patientBiometricsData);
  }
}
