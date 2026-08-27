import {
  NetworkSource,
  SourceQueryData,
  DatasourceQueryEntry,
  DatasourceQueryStatus,
} from "@metriport/shared/domain/network-query/source";
import { CreationOptional, DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";

export type { DatasourceQueryEntry };

export const datasourceQueryTableName = "datasource_query";

/**
 * Datasource query model for tracking queries per data source.
 *
 * Each row represents a query for one data source (hie, pharmacy, lab).
 * Multiple rows share the same requestId to form a complete network query.
 *
 * NOTE: This table is aggregated by the `network_query_request` view,
 * which rolls up all datasource queries with the same requestId into
 * a single network query record with derived status.
 *
 * Example: A request for [hie, lab] creates 2 rows with the same requestId.
 */
export class DatasourceQueryModel extends BaseModel<DatasourceQueryModel> {
  static NAME = datasourceQueryTableName;

  declare cxId: string;
  declare patientId: string;
  /** Shared across all sources in the same request */
  declare requestId: string;
  /** The data source type (hie, pharmacy, lab) */
  declare source: NetworkSource;
  /** Specific source provider (e.g., "national-hie", "surescripts", "quest") */
  declare specificSource: string;
  /** Current status of this source */
  declare status: DatasourceQueryStatus;
  /** When the status was last changed */
  declare statusChangedAt: Date;
  declare completedAt: CreationOptional<Date | undefined>;
  /** Additional data (error info, metadata, etc.) */
  declare data: CreationOptional<SourceQueryData | undefined>;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DatasourceQueryModel.init(
      {
        ...BaseModel.attributes(),
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
        requestId: {
          type: DataTypes.UUID,
          field: "request_id",
          allowNull: false,
        },
        source: {
          type: DataTypes.STRING(50),
          field: "source",
          allowNull: false,
        },
        specificSource: {
          type: DataTypes.STRING(100),
          field: "specific_source",
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING(50),
          field: "status",
          allowNull: false,
        },
        statusChangedAt: {
          type: DataTypes.DATE(6),
          field: "status_changed_at",
          allowNull: false,
        },
        completedAt: {
          type: DataTypes.DATE(6),
          field: "completed_at",
          allowNull: true,
        },
        data: {
          type: DataTypes.JSONB,
          field: "data",
          allowNull: true,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: datasourceQueryTableName,
      }
    );
  };
}
