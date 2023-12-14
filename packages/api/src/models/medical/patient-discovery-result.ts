import { Sequelize } from "sequelize";
import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { PatientDiscoveryResult } from "../../domain/medical/ihe-result";
import { ModelSetup } from "../_default";
import { BaseIHEResultModel } from "./ihe-result";

export class PatientDiscoveryResultModel
  extends BaseIHEResultModel<PatientDiscoveryResultModel>
  implements PatientDiscoveryResult
{
  static NAME = "patient_discovery_result";
  declare data: PatientDiscoveryResponse;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientDiscoveryResultModel.init(BaseIHEResultModel.attributes(), {
      ...BaseIHEResultModel.modelOptions(sequelize),
      tableName: PatientDiscoveryResultModel.NAME,
    });
  };
}
