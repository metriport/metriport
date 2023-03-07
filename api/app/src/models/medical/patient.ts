import { DataTypes, Sequelize } from "sequelize";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Config } from "../../shared/config";
import { USState } from "../../shared/geographic-locations";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";
import { ExternalMedicalPartners } from "./../../external";
import { Address } from "./address";
import { Contact } from "./contact";

export abstract class PatientDataExternal {}

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
export type Identifier = BaseIdentifier &
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

export type PatientData = {
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: GenderAtBirth;
  personalIdentifiers: Identifier[];
  address: Address;
  contact?: Contact;
  externalData?: {
    [k in ExternalMedicalPartners]: PatientDataExternal;
  };
};

export type PatientCreate = Pick<Patient, "cxId" | "facilityIds" | "patientNumber" | "data">;

export class Patient extends BaseModel<Patient> {
  static NAME = "patient";
  declare id: string;
  declare cxId: string;
  declare facilityIds: string[];
  declare patientNumber: number;
  declare data: PatientData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    Patient.init(
      {
        ...BaseModel.baseAttributes(),
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
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
        tableName: Patient.NAME,
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
  const curMaxNumber = (await Patient.max("patientNumber", {
    where: { cxId },
  })) as number;
  const org = await getOrganizationOrFail({ cxId });
  const patientNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;
  const patientId = `${Config.getSystemRootOID()}.${OIDNode.organizations}.${
    org.organizationNumber
  }.${OIDNode.patients}.${patientNumber}`;
  return {
    patientId,
    patientNumber,
  };
}
