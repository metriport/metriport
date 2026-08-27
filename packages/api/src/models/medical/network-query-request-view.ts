import {
  NetworkSource,
  SourceQueryData,
  DatasourceQueryEntry,
  DatasourceQueryStatus,
} from "@metriport/shared/domain/network-query/source";
import { DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";
import { ModelSetup } from "../_default";

export const networkQueryRequestViewName = "network_query_request";

/**
 * Raw source entry as stored in the JSONB `sources` column.
 * Uses camelCase keys matching the SQL jsonb_build_object output.
 * Note: specificSource is required after migration 2026-01-26_00_make-specific-source-required
 */
interface RawSourceEntry {
  source: NetworkSource;
  specificSource: string;
  status: DatasourceQueryStatus;
  createdAt: string;
  completedAt: string | null;
  data: SourceQueryData | null;
}

/**
 * View model for the network_query_request view.
 *
 * This view aggregates datasource_query rows by requestId.
 * It provides pre-aggregated fields: MIN(created_at), MAX(completed_at) when terminal,
 * and a JSONB array of all sources.
 *
 * NOTE: Status derivation is NOT done in the view - it's done in TypeScript
 * to maintain a single source of truth.
 */
export class NetworkQueryRequestViewModel extends Model<
  InferAttributes<NetworkQueryRequestViewModel>,
  InferCreationAttributes<NetworkQueryRequestViewModel>
> {
  static NAME = networkQueryRequestViewName;

  declare id: string;
  declare requestId: string;
  declare cxId: string;
  declare patientId: string;
  declare createdAt: Date;
  declare completedAt: Date | undefined;
  declare sourceCount: number;
  /** Raw JSONB array of sources from the view */
  declare sources: RawSourceEntry[];

  /**
   * Parses the raw JSONB sources array into typed DatasourceQueryEntry[].
   */
  getDatasources(): DatasourceQueryEntry[] {
    return this.sources.map(raw => ({
      source: raw.source,
      specificSource: raw.specificSource,
      status: raw.status,
      createdAt: new Date(raw.createdAt),
      completedAt: raw.completedAt ? new Date(raw.completedAt) : undefined,
      data: raw.data ?? undefined,
    }));
  }

  static setup: ModelSetup = (sequelize: Sequelize) => {
    NetworkQueryRequestViewModel.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        requestId: {
          type: DataTypes.UUID,
          field: "request_id",
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
        createdAt: {
          type: DataTypes.DATE(6),
          field: "created_at",
          allowNull: false,
        },
        completedAt: {
          type: DataTypes.DATE(6),
          field: "completed_at",
          allowNull: true,
        },
        sourceCount: {
          type: DataTypes.INTEGER,
          field: "source_count",
          allowNull: false,
        },
        sources: {
          type: DataTypes.JSONB,
          field: "sources",
          allowNull: false,
        },
      },
      {
        sequelize,
        freezeTableName: true,
        underscored: true,
        timestamps: false,
        tableName: networkQueryRequestViewName,
      }
    );
  };
}
