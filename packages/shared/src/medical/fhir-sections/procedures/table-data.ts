import { Procedure } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { getResourcesFromBundle, getValidCode, MappedConsolidatedResources, SectionKey } from "..";
import { ISO_WITH_TIMESTAMP_FORMAT } from "../../../common/date";

export type ProcedureRowData = {
  id: string;
  procedure: string;
  datePerformed: string;
  status: string;
  originalData: Procedure;
  ehrAction?: string;
};

type ProcedureOccurrence = {
  rawProcedure: Procedure;
  date: string | undefined;
  time: string | undefined;
};

export type GroupedProcedures = {
  title: string;
  mostRecentProcedure: Procedure;
  sortedOccurrences?: ProcedureOccurrence[];
  status: string;
};

export function procedureTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const procedures = getResourcesFromBundle<Procedure>(bundle, "Procedure");
  const groupedProcedures = groupProcedures(procedures);
  return {
    key: "procedures" as SectionKey,
    rowData: getProcedureRowData({ procedures: groupedProcedures }),
  };
}

export function groupProcedures(procedures: Procedure[]): GroupedProcedures[] {
  const results: GroupedProcedures[] = [];
  const procedureMap: {
    [k: string]: {
      rawProcedure: Procedure;
      date: string | undefined;
      time: string | undefined;
      status: string;
    }[];
  } = {};
  procedures.map(p => {
    let title: string;
    const codings = getValidCode(p.code?.coding);
    const displays = codings.map(coding => coding.display);
    const text = p.code?.text;
    if (displays.length) {
      title = Array.from(new Set(displays)).join(", ");
    } else if (text) {
      title = text;
    } else {
      results.push({ title: "-", mostRecentProcedure: p, status: getProcedureStatus(p) });
      return;
    }
    if (!p.performedPeriod && !p.performedDateTime) {
      results.push({ title, mostRecentProcedure: p, status: getProcedureStatus(p) });
      return;
    }

    const dateTime = getPerformedTime(p);

    const procedurePoint = {
      rawProcedure: p,
      date: dateTime?.date,
      time: dateTime?.time,
      status: getProcedureStatus(p),
    };

    const groupedProcedure = procedureMap[title];
    if (groupedProcedure) {
      groupedProcedure.push(procedurePoint);
    } else {
      procedureMap[title] = [procedurePoint];
    }
  });

  Object.entries(procedureMap).map(([title, values]) => {
    const sortedOccurrences = values.sort((a, b) => {
      const aDateTime = combineDateTime(a.date, a.time);
      const bDateTime = combineDateTime(b.date, b.time);

      const dateA = aDateTime ? new Date(aDateTime).getTime() : 0;
      const dateB = bDateTime ? new Date(bDateTime).getTime() : 0;

      return dateB - dateA;
    });

    const mostRecent = sortedOccurrences[0];
    if (!mostRecent) return;
    results.push({
      title,
      mostRecentProcedure: mostRecent.rawProcedure,
      sortedOccurrences,
      status: mostRecent.status,
    });
  });
  return results;
}

function combineDateTime(date: string | undefined, time: string | undefined): string | undefined {
  if (date && time) {
    return `${date} ${time}`;
  } else if (date) {
    return date;
  }
  return undefined;
}

function getPerformedTime(procedure: Procedure):
  | {
      date: string | undefined;
      time: string | undefined;
    }
  | undefined {
  const performedDateTime = procedure.performedDateTime;
  const performedPeriodStart = procedure.performedPeriod?.start;
  const performedPeriodEnd = procedure.performedPeriod?.end;

  const time = performedDateTime || performedPeriodStart || performedPeriodEnd;
  if (!time) return undefined;
  const dateTimeString = dayjs.utc(time).format(ISO_WITH_TIMESTAMP_FORMAT);
  return {
    date: dateTimeString.split(" ")[0] ?? undefined,
    time: dateTimeString.split(" ").slice(1).join(" "),
  };
}

function getProcedureRowData({
  procedures,
}: {
  procedures: GroupedProcedures[];
}): ProcedureRowData[] {
  return procedures?.map(procedure => ({
    id: procedure.mostRecentProcedure.id ?? "-",
    procedure: getProcedureName(procedure.mostRecentProcedure),
    datePerformed: getProcedureDatePerformed(procedure.mostRecentProcedure),
    status: procedure.status ?? "-",
    originalData: procedure.mostRecentProcedure,
  }));
}

function getProcedureName(procedure: Procedure): string {
  const displayText = procedure.code?.coding?.flatMap(coding => coding.display || []).join(", ");
  return procedure.code?.text ?? (displayText && displayText.length ? displayText : "-");
}

function getProcedureStatus(procedure: Procedure): string {
  return procedure.status ?? "-";
}

function getProcedureDatePerformed(procedure: Procedure): string {
  const validDate = procedure.performedDateTime ?? procedure.performedPeriod?.start;

  if (!validDate) {
    return "-";
  }

  return dayjs.utc(validDate).format(ISO_WITH_TIMESTAMP_FORMAT);
}
