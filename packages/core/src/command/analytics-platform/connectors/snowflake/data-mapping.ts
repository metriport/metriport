import { ColumnDefinition } from "../../sql";

export function getSnowflakeDataTypeString(column: ColumnDefinition): string {
  const pgType = column.dataType.toLowerCase();

  // Map PostgreSQL types to Snowflake types
  switch (pgType) {
    case "text":
    case "varchar":
    case "character varying":
    case "char":
    case "character":
      return "STRING";
    case "integer":
    case "int":
    case "int4":
    case "bigint":
    case "int8":
    case "smallint":
    case "int2":
    case "serial":
    case "bigserial":
    case "smallserial":
      return "NUMBER";
    case "numeric":
    case "decimal":
    case "real":
    case "double precision":
    case "float":
    case "float4":
    case "float8":
      return "NUMBER";
    case "boolean":
    case "bool":
      return "BOOLEAN";
    case "json":
    case "jsonb":
    case "uuid":
    case "array":
      return "VARIANT";
    case "timestamp":
    case "timestamp without time zone":
    case "timestamp with time zone":
    case "timestamptz":
    case "date":
    case "time":
    case "time without time zone":
    case "time with time zone":
    case "timetz":
      return "STRING";
    default:
      // For unknown types, default to STRING
      return "STRING";
  }
}
