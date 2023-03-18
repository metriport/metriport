import { DataTypes, Sequelize } from "sequelize";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { MedicalDataSource } from "../../external";
import { USState } from "../../shared/geographic-locations";
import { OID_ID_START, patientId as makePatientId } from "../../shared/oid";
import { BaseModel, defaultModelOptions, IBaseModel, ModelSetup } from "../_default";
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
export type PersonalIdentifier = BaseIdentifier &
  (
    | { type: GeneralTypes; value: string; state?: never }
    | { type: DriverLicenseType; value: string; state: USState }
  );

export type DriversLicense = {
  value: string;
  state: USState;
};

export const genderAtBirthTypes = ["F", "M"] as const;
export type GenderAtBirth = (typeof genderAtBirthTypes)[number];

export abstract class PatientExternalDataEntry {}

export type PatientExternalData = Partial<Record<MedicalDataSource, PatientExternalDataEntry>>;

export type PatientData = {
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: GenderAtBirth;
  personalIdentifiers: PersonalIdentifier[];
  address: Address;
  contact?: Contact;
  externalData?: PatientExternalData;
};

export type PatientCreate = Pick<Patient, "cxId" | "facilityIds" | "patientNumber" | "data">;

export interface Patient extends IBaseModel {
  cxId: string;
  facilityIds: string[];
  patientNumber: number;
  data: PatientData;
}

export class PatientModel extends BaseModel<PatientModel> implements Patient {
  static NAME = "patient";
  declare cxId: string;
  declare facilityIds: string[];
  declare patientNumber: number;
  declare data: PatientData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientModel.init(
      {
        ...BaseModel.baseAttributes(),
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
        ...defaultModelOptions(sequelize),
        tableName: PatientModel.NAME,
        hooks: {
          async beforeCreate(attributes) {
            const { patientId, patientNumber } = await createPatientId(attributes.cxId);
            attributes.id = patientId;
            attributes.patientNumber = patientNumber;
          },
        },
      }
    );
  };
}

async function createPatientId(cxId: string) {
  const curMaxNumber = (await PatientModel.max("patientNumber", {
    where: { cxId },
  })) as number;
  const org = await getOrganizationOrFail({ cxId });
  const patientNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;
  const patientId = makePatientId(org.id, patientNumber);
  return {
    patientId,
    patientNumber,
  };
}
