export type TableDefinition = {
  tableName: string;
  columns: ColumnDefinition[];
};

export type ColumnDefinition = {
  columnName: string;
  dataType: string;
};

export type ColumnRowValue = {
  name: string;
  value: string;
};

export type CreateStatement = {
  tableName: string;
  createStatement: string;
};
