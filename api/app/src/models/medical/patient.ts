import { DataTypes, Sequelize } from "sequelize";
import { BaseDomain, BaseDomainCreate } from "../../domain/base-domain";
import {
  DocumentQueryStatus,
  DocumentQueryProgress,
} from "../../domain/medical/document-reference";
import { MedicalDataSource } from "../../external";
import { USState } from "../../shared/geographic-locations";
import { BaseModel, ModelSetup } from "../_default";
import { Address } from "./address";
import { Contact } from "./contact";

export const generalTypes = ["passport", "ssn", "medicare"] as const;
export const driversLicenseType = ["driversLicense"] as const;
export type GeneralTypes = (typeof generalTypes)[number];
export type DriverLicenseType = (typeof driversLicenseType)[number];

export type Period =
  | {
      start: string;
      end?: string;
    }
  | {
      start?: string;
      end: string;
    };

export type BaseIdentifier = {
  period?: Period;
  assigner?: string;
};
// TODO #425 reenable this when we manage to work with diff systems @ CW
// export type PersonalIdentifier = BaseIdentifier &
//   (
//     | { type: GeneralTypes; value: string; state?: never }
//     | { type: DriverLicenseType; value: string; state: USState }
//   );
export type PersonalIdentifier = BaseIdentifier & {
  type: DriverLicenseType;
  value: string;
  state: USState;
};

export type DriversLicense = {
  value: string;
  state: USState;
};

export const genderAtBirthTypes = ["F", "M"] as const;
export type GenderAtBirth = (typeof genderAtBirthTypes)[number];

export abstract class PatientExternalDataEntry {}

export type PatientExternalData = Partial<Record<MedicalDataSource, PatientExternalDataEntry>>;

export type PatientData = {
  firstName: string[];
  lastName: string[];
  dob: string;
  genderAtBirth: GenderAtBirth;
  personalIdentifiers: PersonalIdentifier[];
  address: Address[];
  contact?: Contact[] | null | undefined;
  documentQueryStatus?: DocumentQueryStatus;
  documentQueryProgress?: DocumentQueryProgress;
  externalData?: PatientExternalData;
};

export interface PatientCreate extends BaseDomainCreate {
  cxId: string;
  facilityIds: string[];
  patientNumber: number;
  data: PatientData;
}

export interface Patient extends BaseDomain, PatientCreate {}

export class PatientModel extends BaseModel<PatientModel> implements Patient {
  static NAME = "patient";
  declare cxId: string;
  declare facilityIds: string[];
  declare patientNumber: number;
  declare data: PatientData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        facilityIds: {
          type: DataTypes.ARRAY(DataTypes.STRING),
        },
        patientNumber: {
          type: DataTypes.INTEGER,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientModel.NAME,
      }
    );
  };
}
