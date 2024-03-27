/* eslint-disable @typescript-eslint/no-unused-vars */
import { Biometrics, Body } from "@metriport/api-sdk";
import axios from "axios";
import dayjs from "dayjs";
import stringify from "json-stringify-safe";
import { updateProviderData } from "../command/connected-user/save-connected-user";
import BadRequestError from "../errors/bad-request";
import MetriportError from "../errors/metriport-error";
import NotFoundError from "../errors/not-found";
import { TenoviMeasurementData, tenoviMeasurementDataSchema } from "../mappings/tenovi";
import { mapToBiometrics } from "../mappings/tenovi/biometrics";
import { mapToBody } from "../mappings/tenovi/body";
import { ConnectedUser } from "../models/connected-user";
import { PROVIDER_TENOVI } from "../shared/constants";
import { RawParams } from "../shared/raw-params";
import Provider, { ConsumerHealthDataType, DAPIParams } from "./provider";
import { NoAuth } from "./shared/noauth";

export const TENOVI_DEFAULT_TOKEN_VALUE = "N/A";
const TENOVI_TEST_DEVICE_ID = "12345678-abcd-1234-abcd-1234567890ab";

export type TenoviExtraParams = DAPIParams & {
  xTenoviApiKey?: string;
  xTenoviClientName?: string;
};

export const tenoviApiKeyPropName = "x-tenovi-api-key";
export const tenoviClientNamePropName = "x-tenovi-client-name";

type TenoviHeaderPropName = typeof tenoviApiKeyPropName | typeof tenoviClientNamePropName;

export function getTenoviHeaderOrFail(
  propName: TenoviHeaderPropName,
  rawParams: RawParams
): string {
  const tenoviHeader = rawParams.headers[propName];
  if (!tenoviHeader) throw new BadRequestError(`Missing ${propName} header.`);
  return validateAndEncodeTenoviHeader(tenoviHeader);
}

function validateAndEncodeTenoviHeader(tenoviHeader: string | string[]): string {
  if (tenoviHeader.includes(" ") || Array.isArray(tenoviHeader))
    throw new BadRequestError(`Invalid ${tenoviApiKeyPropName} header.`);
  return encodeURIComponent(tenoviHeader);
}

export class Tenovi extends Provider implements NoAuth {
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
   * @param connectedUser The user to disconnect the device from.
   * @param rawParams     The raw request parameters.
   */
  async revokeProviderAccess(connectedUser: ConnectedUser, rawParams: RawParams): Promise<void> {
    const connectedDevices = connectedUser.providerMap?.tenovi?.connectedDeviceIds;
    if (connectedDevices && connectedDevices.length) {
      const res = await Promise.allSettled(
        connectedDevices.map(async deviceId => {
          await this.disconnectDevice(connectedUser, deviceId, false, rawParams);
        })
      );

      const rejected = res.filter(r => r.status === "rejected");
      if (rejected.length) {
        throw new MetriportError(`Failed to disconnect device(s) from Tenovi Gateway.`, undefined, {
          numberOfDevices: rejected.length.toString(),
          user: connectedUser.dataValues.id,
        });
      }
      await updateProviderData({
        id: connectedUser.id,
        cxId: connectedUser.cxId,
        provider: PROVIDER_TENOVI,
        providerItem: undefined,
      });
    }
  }

  /**
   * Disconnects the device from the user's Tenovi Gateway.
   * Optionally updates the user's connected devices list.
   *
   * @param connectedUser The user to disconnect the device from.
   * @param deviceId      The device to disconnect.
   * @param updateUser    Whether to update the user's connected devices list.
   * @param rawParams     The raw request parameters.
   */
  async disconnectDevice(
    connectedUser: ConnectedUser,
    deviceId: string,
    updateUser: boolean,
    rawParams: RawParams
  ): Promise<void> {
    const connectedDevices = connectedUser.providerMap?.tenovi?.connectedDeviceIds;
    const xTenoviApiKey = getTenoviHeaderOrFail(tenoviApiKeyPropName, rawParams);
    const xTenoviClientName = getTenoviHeaderOrFail(tenoviClientNamePropName, rawParams);

    if (connectedDevices && connectedDevices.includes(deviceId)) {
      const url = `${Tenovi.URL}/${Tenovi.API_PATH}/${xTenoviClientName}/hwi/unlink-gateway/${deviceId}/`;

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
    } else {
      throw new NotFoundError("Device not found for this user.", undefined, { deviceId });
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
    extraParams: DAPIParams,
    rawParams: RawParams
  ): Promise<Body> {
    const xTenoviApiKey = getTenoviHeaderOrFail(tenoviApiKeyPropName, rawParams);
    const xTenoviClientName = getTenoviHeaderOrFail(tenoviClientNamePropName, rawParams);

    const startDate = dayjs(date).toISOString();
    const endDate = dayjs(date).add(1, "day").toISOString();

    let patientId = connectedUser.providerMap?.tenovi?.deviceUserId;
    if (patientId) patientId = encodeURIComponent(patientId);

    const patientMeasUrl = `${Tenovi.URL}/${Tenovi.API_PATH}/${xTenoviClientName}/hwi/patients/${patientId}/measurements/?metric__name=weight&timestamp__gte=${startDate}&timestamp__lt=${endDate}`;
    const weightData = await this.fetchPatientData(patientMeasUrl, xTenoviApiKey);

    return mapToBody(date, weightData);
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams,
    rawParams: RawParams
  ): Promise<Biometrics> {
    const xTenoviApiKey = getTenoviHeaderOrFail(tenoviApiKeyPropName, rawParams);
    const xTenoviClientName = getTenoviHeaderOrFail(tenoviClientNamePropName, rawParams);

    const startDate = dayjs(date).toISOString();
    const endDate = dayjs(date).add(1, "day").toISOString();

    let patientId = connectedUser.providerMap?.tenovi?.deviceUserId;
    if (patientId) patientId = encodeURIComponent(patientId);

    const patientMeasUrl = `${Tenovi.URL}/${Tenovi.API_PATH}/${xTenoviClientName}/hwi/patients/${patientId}/measurements/?timestamp__gte=${startDate}&timestamp__lt=${endDate}`;
    const biometricsData = await this.fetchPatientData(patientMeasUrl, xTenoviApiKey);

    return mapToBiometrics(date, biometricsData);
  }
}
