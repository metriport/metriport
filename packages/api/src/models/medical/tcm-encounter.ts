import { DataTypes, Model, Sequelize } from "sequelize";
import { TcmEncounter, TcmEncounterLatestEvent } from "../../domain/medical/tcm-encounter";
import { ModelSetup } from "../_default";

export class TcmEncounterModel extends Model<TcmEncounter> implements TcmEncounter {
  declare id: string;
  declare cxId: string;
  declare patientId: string;
  declare facilityName: string;
  declare latestEvent: TcmEncounterLatestEvent;
  declare class: string;
  declare admitTime: Date | null;
  declare dischargeTime: Date | null;
  declare clinicalInformation: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare version: number;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    TcmEncounterModel.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
          allowNull: false,
        },
        patientId: {
          type: DataTypes.UUID,
          field: "patient_id",
          allowNull: false,
        },
        facilityName: {
          type: DataTypes.STRING,
          field: "facility_name",
          allowNull: false,
        },
        latestEvent: {
          type: DataTypes.ENUM("Admitted", "Transferred", "Discharged"),
          field: "latest_event",
          allowNull: false,
        },
        class: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        admitTime: {
          type: DataTypes.DATE,
          field: "admit_time",
          allowNull: true,
        },
        dischargeTime: {
          type: DataTypes.DATE,
          field: "discharge_time",
          allowNull: true,
        },
        clinicalInformation: {
          type: DataTypes.JSONB,
          field: "clinical_information",
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          field: "created_at",
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          field: "updated_at",
          allowNull: false,
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
      },
      {
        sequelize,
        tableName: "tcm_encounter",
        timestamps: true,
        version: true,
      }
    );
  };
}
