import { ObservationTableRow } from "../cda-types/shared-types";

type TableHeader = {
  tr: {
    th: {
      "#text": string;
      _colspan?: number;
    }[];
  }[];
};

type TableCell = {
  "#text"?: string | undefined;
};

type TableRowWithId = {
  _ID: string;
  td: TableCell[];
};

export function createTableHeader(
  tableHeaders: string[],
  specialHeader?: string | undefined
): TableHeader {
  return {
    tr: [
      ...(specialHeader
        ? [
            {
              th: [
                {
                  "#text": specialHeader,
                  _colspan: tableHeaders.length,
                },
              ],
            },
          ]
        : []),
      {
        th: tableHeaders.map(header => ({
          "#text": header,
        })),
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
  tableRows: ObservationTableRow[],
  specialHeader?: string
): CdaTable {
  return {
    table: {
      _ID: sectionName,
      thead: createTableHeader(tableHeaders, specialHeader),
      tbody: {
        tr: mapTableRows(tableRows),
      },
    },
  };
}
