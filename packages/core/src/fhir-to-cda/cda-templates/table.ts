import { ObservationTableRow } from "../cda-types/shared-types";

type TableHeader = {
  tr: {
    th: string[];
  }[];
};

type TableCell = {
  "#text"?: string | undefined;
};

type TableRowWithId = {
  _ID: string;
  td: TableCell[];
};

export function createTableHeader(tableHeaders: string[]): TableHeader {
  return {
    tr: [
      {
        th: tableHeaders,
      },
    ],
  };
}

export type CdaTable = {
  table: {
    _ID: string;
    thead: TableHeader;
    tbody: {
      tr: TableRowWithId[];
    };
  };
};

function mapTableRows(tableRows: ObservationTableRow[]): TableRowWithId[] {
  return tableRows.map((row: ObservationTableRow) => ({
    _ID: row.tr._ID,
    td: row.tr.td,
  }));
}

export function initiateSectionTable(
  sectionName: string,
  tableHeaders: string[],
  tableRows: ObservationTableRow[]
): CdaTable {
  return {
    table: {
      _ID: sectionName,
      thead: createTableHeader(tableHeaders),
      tbody: {
        tr: mapTableRows(tableRows),
      },
    },
  };
}
