import { Sequelize } from "sequelize";
import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { IHEResult } from "../../domain/medical/ihe-result";
import { ModelSetup, BaseIHEResultModel } from "../_default";
export class PatientDiscoveryResultModel
  extends BaseIHEResultModel<PatientDiscoveryResultModel>
  implements IHEResult<PatientDiscoveryResponse>
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
