import { DataTypes, Sequelize } from "sequelize";
import { TcmEncounter } from "../../domain/medical/tcm-encounter";
import { BaseModel, ModelSetup } from "../_default";

export type TcmEncounterCreation = Omit<TcmEncounter, "id" | "createdAt" | "updatedAt" | "eTag">;

export class TcmEncounterModel extends BaseModel<TcmEncounterModel> implements TcmEncounter {
  static NAME = "tcm_encounter";
  declare cxId: string;
  declare patientId: string;
  declare facilityName: string;
  declare latestEvent: "Admitted" | "Transferred" | "Discharged";
  declare class: string;
  declare admitTime: Date | null;
  declare dischargeTime: Date | null;
  declare clinicalInformation: Record<string, unknown>;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    TcmEncounterModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.UUID,
        },
        facilityName: {
          type: DataTypes.STRING,
        },
        latestEvent: {
          type: DataTypes.ENUM("Admitted", "Transferred", "Discharged"),
        },
        class: {
          type: DataTypes.STRING,
        },
        admitTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        dischargeTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        clinicalInformation: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: TcmEncounterModel.NAME,
      }
    );
  };
}
