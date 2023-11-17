// import { DataTypes, Sequelize } from "sequelize";
// import { CQOrganization } from "../../domain/medical/cq-directory";
// import { BaseModel, ModelSetup } from "../../models/_default";

// // export class CQDirectoryModel extends BaseModel<CQDirectoryModel> implements CQOrganization {
// export class CQDirectoryModel extends BaseModel<CQDirectoryModel> {
//   static NAME = "cq_directory";
//   // declare oid: string;
//   // declare name?: string;
//   // declare urlXCPD: string;
//   // declare urlDQ?: string;
//   // declare urlDR?: string;
//   // declare latitude?: string;
//   // declare longitude?: string;
//   // declare data: any;
//   // declare state?: string;

//   static setup: ModelSetup = (sequelize: Sequelize) => {
//     CQDirectoryModel.init(
//       {
//         ...BaseModel.attributes(),
//         // oid: {
//         //   type: DataTypes.STRING,
//         // },
//         // name: {
//         //   type: DataTypes.STRING,
//         // },
//         // urlXCPD: {
//         //   type: DataTypes.STRING,
//         // },
//         // urlDQ: {
//         //   type: DataTypes.STRING,
//         // },
//         // urlDR: {
//         //   type: DataTypes.STRING,
//         // },
//         // latitude: {
//         //   type: DataTypes.STRING,
//         // },
//         // longitude: {
//         //   type: DataTypes.STRING,
//         // },
//         // state: {
//         //   type: DataTypes.STRING,
//         // },
//         // data: {
//         //   type: DataTypes.JSONB,
//         // },
//       },
//       {
//         ...BaseModel.modelOptions(sequelize),
//         tableName: "cq_directory",
//         // tableName: CQDirectoryModel.NAME,
//       }
//     );
//   };
// }

import { DataTypes, Sequelize } from "sequelize";
import { Organization, OrganizationData } from "../../domain/medical/organization";
import { BaseModel, ModelSetup } from "../../models/_default";

export class CQDirectoryModel extends BaseModel<CQDirectoryModel> implements Organization {
  static NAME = "cq_directory";
  declare cxId: string;
  declare oid: string;
  declare organizationNumber: number;
  declare data: OrganizationData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CQDirectoryModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        oid: {
          type: DataTypes.STRING,
        },
        organizationNumber: {
          type: DataTypes.INTEGER,
          unique: true,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: CQDirectoryModel.NAME,
      }
    );
  };
}
