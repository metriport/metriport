import { DataTypes, Sequelize } from "sequelize";
import { TcmEncounter } from "../../domain/medical/tcm-encounter";
import { BaseModel, ModelSetup } from "../_default";
import { OrganizationModel } from "./organization";
import { PatientModel } from "./patient";

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
          allowNull: false,
          references: {
            model: "organization",
            key: "cxId",
          },
        },
        patientId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: "patient",
            key: "id",
          },
        },
        facilityName: {
          type: DataTypes.STRING,
        },
        latestEvent: {
          type: DataTypes.ENUM("Admitted", "Transferred", "Discharged"),
          allowNull: false,
        },
        class: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        admitTime: {
          type: DataTypes.DATE,
        },
        dischargeTime: {
          type: DataTypes.DATE,
        },
        clinicalInformation: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: TcmEncounterModel.NAME,
      }
    );
  };

  static associate = (models: {
    PatientModel: typeof PatientModel;
    OrganizationModel: typeof OrganizationModel;
  }) => {
    TcmEncounterModel.belongsTo(models.PatientModel, {
      foreignKey: "patientId",
      targetKey: "id",
    });

    TcmEncounterModel.belongsTo(models.OrganizationModel, {
      foreignKey: "cxId",
      targetKey: "cxId",
    });
  };
}
