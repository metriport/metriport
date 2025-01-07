import { Organization } from "@medplum/fhirtypes";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { CQDirectoryEntry2 } from "../cq-directory";

export class CQDirectoryEntryViewModel
  extends BaseModel<CQDirectoryEntryViewModel>
  implements CQDirectoryEntry2
{
  static NAME = "cq_directory_entry_view";
  declare id: string; // Organization's OID
  declare name?: string;
  declare active: boolean;
  declare managingOrganization?: string;
  declare managingOrganizationId?: string;
  declare data?: Organization;
  declare urlXCPD?: string;
  declare urlDQ?: string;
  declare urlDR?: string;
  declare lat?: number;
  declare lon?: number;
  declare point?: string;
  declare addressLine?: string;
  declare city?: string;
  declare state?: string;
  declare zip?: string;
  declare lastUpdatedAtCQ: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CQDirectoryEntryViewModel.init(
      {
        ...BaseModel.attributes(),
        name: {
          type: DataTypes.STRING,
        },
        active: {
          type: DataTypes.BOOLEAN,
        },
        managingOrganization: {
          type: DataTypes.STRING,
          field: "managing_organization",
        },
        managingOrganizationId: {
          type: DataTypes.STRING,
          field: "managing_organization_id",
        },
        data: {
          type: DataTypes.JSONB,
        },
        urlXCPD: {
          type: DataTypes.STRING,
          field: "url_xcpd",
          allowNull: true,
        },
        urlDQ: {
          type: DataTypes.STRING,
          field: "url_dq",
        },
        urlDR: {
          type: DataTypes.STRING,
          field: "url_dr",
        },
        addressLine: {
          type: DataTypes.STRING,
          field: "address_line",
        },
        city: {
          type: DataTypes.STRING,
        },
        state: {
          type: DataTypes.STRING,
        },
        zip: {
          type: DataTypes.STRING,
        },
        lat: {
          type: DataTypes.FLOAT,
        },
        lon: {
          type: DataTypes.FLOAT,
        },
        point: {
          type: "CUBE",
        },
        lastUpdatedAtCQ: {
          type: DataTypes.STRING,
          field: "last_updated_at_cq",
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: CQDirectoryEntryViewModel.NAME,
      }
    );
  };
}
