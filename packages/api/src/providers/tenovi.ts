import { Biometrics, Body } from "@metriport/api-sdk";
import axios from "axios";
import dayjs from "dayjs";
import { TenoviMeasurementData, tenoviMeasurementDataSchema } from "../mappings/tenovi";
import { mapToBiometrics } from "../mappings/tenovi/biometrics";
import { mapToBody } from "../mappings/tenovi/body";
import { ConnectedUser } from "../models/connected-user";
import { Config } from "../shared/config";
import Provider, { ConsumerHealthDataType, DAPIParams } from "./provider";

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
    // TODO: If no extraParams.patientId -> throw err?

    const startDate = dayjs(date).toISOString();
    const endDate = dayjs(date).add(1, "day").toISOString();

    const patientMeasUrl = `${Tenovi.URL}/${Tenovi.API_PATH}/hwi/patients/${extraParams.patientId}/measurements/?metric__name=weight&timestamp__gte=${startDate}&timestamp__lt=${endDate}`;
    const weightData = await this.fetchPatientData(patientMeasUrl);

    return mapToBody(date, weightData);
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Biometrics> {
    // TODO: If no extraParams.patientId -> throw err?

    const startDate = dayjs(date).toISOString();
    const endDate = dayjs(date).add(1, "day").toISOString();

    const patientMeasUrl = `${Tenovi.URL}/${Tenovi.API_PATH}/hwi/patients/${extraParams.patientId}/measurements/?timestamp__gte=${startDate}&timestamp__lt=${endDate}`;
    const patientBiometricsData = await this.fetchPatientData(patientMeasUrl);

    return mapToBiometrics(date, patientBiometricsData);
  }
}
