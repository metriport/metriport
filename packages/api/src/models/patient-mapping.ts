import { MetriportError } from "@metriport/shared";
import { DataTypes, Sequelize } from "sequelize";
import { PatientMapping, PatientMappingSource } from "../domain/patient-mapping";
import { BaseModel, generateETag, ModelSetup } from "./_default";

const patientMappingColumnNames: Record<
  keyof (Omit<PatientMapping, "eTag"> & { version: string }),
  string
> = {
  id: "id",
  externalId: "external_id",
  cxId: "cx_id",
  patientId: "patient_id",
  source: "source",
  createdAt: "created_at",
  updatedAt: "updated_at",
  version: "version",
};

export class PatientMappingModel extends BaseModel<PatientMappingModel> implements PatientMapping {
  static NAME = "patient_mapping";
  declare externalId: string;
  declare cxId: string;
  declare patientId: string;
  declare source: PatientMappingSource;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientMappingModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.UUID,
        },
        source: {
          type: DataTypes.STRING,
        },
        externalId: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientMappingModel.NAME,
      }
    );
  };
}

export function rawToDomain(raw: Record<string, string>): PatientMapping {
  const createdAtRaw = raw[patientMappingColumnNames.createdAt];
  if (!createdAtRaw) throw new MetriportError("createdAt is required to create a patient mapping");
  const updatedAtRaw = raw[patientMappingColumnNames.updatedAt];
  if (!updatedAtRaw) throw new MetriportError("updatedAt is required to create a patient mapping");
  const versionRaw = raw[patientMappingColumnNames.version];
  if (versionRaw == undefined) {
    throw new MetriportError("version is required to create a patient mapping");
  }
  const version = parseInt(versionRaw);
  if (isNaN(version)) throw new MetriportError("version must be a number");
  const id = raw[patientMappingColumnNames.id];
  const obj: PatientMapping = {
    id,
    patientId: raw[patientMappingColumnNames.patientId],
    externalId: raw[patientMappingColumnNames.externalId],
    source: raw[patientMappingColumnNames.source] as PatientMappingSource,
    cxId: raw[patientMappingColumnNames.cxId],
    createdAt: new Date(createdAtRaw),
    updatedAt: new Date(updatedAtRaw),
    eTag: generateETag(id, version),
  };
  return obj;
}
