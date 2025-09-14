import { DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import {
  filterByDate,
  formatDate,
  getResourceIdFromReference,
  getResourcesFromBundle,
  getValidCode,
  MappedConsolidatedResources,
  SectionKey,
} from "..";
import {
  DetailedReportRowData,
  GroupedLabs,
  GroupedObservation,
  LabRowData,
  filterOutCaseReports,
  getColorForInterpretation,
  getLabReports,
  getLabs,
  getLabsDate,
  getLabsDisplay,
  getRenderValue,
  getReportName,
  getValueAndInterpretation,
  renderLabReferenceRange,
} from "./shared";

export function labTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const diagnosticReports = getResourcesFromBundle<DiagnosticReport>(bundle, "DiagnosticReport");
  const labReports = getLabReports(diagnosticReports);
  const observations = getResourcesFromBundle<Observation>(bundle, "Observation");
  const labObservations = getLabs(observations);
  const labsNotCaseReports = filterOutCaseReports(labObservations);

  const groupedLabs = groupLabs(labsNotCaseReports);

  const detailedReports: DetailedReportRowData[] = labReports
    .flatMap(report => {
      const resultRefs = report.result;
      const results = labsNotCaseReports.filter(obs =>
        resultRefs?.some(ref => getResourceIdFromReference(ref.reference) === obs.id)
      );

      // TODO: maybe keep the report if there's overview data that's useful
      if (!results.length) return [];

      const reportDate = report.effectiveDateTime ?? report.effectivePeriod?.start;
      return {
        id: report.id ?? "-",
        name: getReportName(report) ?? "Unknown panel",
        date: reportDate ? dayjs(reportDate).format(ISO_DATE) : "-",
        rawReport: report,
        results,
      };
    })
    .sort((a, b) => (new Date(a.date).getTime() > new Date(b.date).getTime() ? -1 : 1));

  // Generate the drill-down data for each panel
  const panelDrillDownData = getLabsRowData({ detailedReports });

  // Embed both views in the rowData - the LabsSection component will know how to extract them
  const individualData = getGroupedLabsRowData({ labs: groupedLabs });

  /**
   * ⚠️ This is a hack that sneakily embeds the data for the individual and panel views in the rowData.
   * The LabsSection component knows how to extract them.
   */
  const combinedRowData = [
    {
      _labsViewData: {
        individualView: {
          rowData: individualData,
        },
        panelView: {
          rowData: detailedReports,
        },
        panelDrillDownData,
      },
    },
  ];

  return {
    key: "labs" as SectionKey,
    rowData: combinedRowData,
  };
}

function getLabsRowData({
  detailedReports,
}: {
  detailedReports: DetailedReportRowData[];
}): Map<string, LabRowData[]> {
  const rowsMap = new Map<string, LabRowData[]>();

  detailedReports.map(report =>
    report.results?.map(obs => {
      const { value, unit, interpretation, referenceRange } = getValueAndInterpretation(obs);

      const newRow: LabRowData = {
        id: obs.id ?? "-",
        observation: getLabsDisplay(obs),
        date: report.date,
        value: getRenderValue(value, unit),
        interpretation: interpretation ?? "-",
        referenceRange: renderLabReferenceRange(referenceRange, unit),
        rowColor: getColorForInterpretation(interpretation),
      };

      if (rowsMap.has(report.id)) {
        const existing = rowsMap.get(report.id);
        if (existing) {
          rowsMap.set(report.id, [...existing, newRow]);
        }
      } else {
        rowsMap.set(report.id, [newRow]);
      }
    })
  );

  rowsMap.forEach((rows, reportId) => {
    const filteredRows = rows.filter(row => filterByDate(row.date));
    filteredRows.sort((a, b) => {
      if (!a.date) return -Infinity;
      if (!b.date) return Infinity;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    rowsMap.set(reportId, filteredRows);
  });

  return rowsMap;
}

export function groupLabs(labs: Observation[]): GroupedLabs[] {
  const results: GroupedLabs[] = [];
  const observationMap = new Map<string, GroupedObservation[]>();

  labs.map(obs => {
    let title: string;
    const codings = getValidCode(obs.code?.coding);
    const displays = codings.map(coding => coding.display);
    if (displays.length) {
      title = Array.from(new Set(displays)).join(", ");
    } else if (obs.code?.text) {
      title = obs.code.text;
      if (title.toLowerCase().includes("no data") || title.toLowerCase().includes("none recorded"))
        return;
    } else {
      results.push({ title: "-", mostRecentObservation: obs });
      return;
    }

    const {
      value: labValue,
      unit,
      interpretation,
      referenceRange,
    } = getValueAndInterpretation(obs);
    if (!obs.effectiveDateTime || (!labValue && !interpretation)) {
      return;
    }

    const observationPoint: GroupedObservation = {
      id: obs.id ?? "-",
      date: obs.effectiveDateTime ? formatDate(obs.effectiveDateTime) : "-",
      unit: unit ?? "-",
      value: getRenderValue(labValue, unit),
      numericValue:
        typeof labValue === "number" ? labValue : labValue ? parseFloat(labValue) : undefined,
      interpretation: interpretation ?? "-",
      referenceRange: renderLabReferenceRange(referenceRange, unit),
      rawLabObs: obs,
    };

    const groupedObservation = observationMap.get(title);
    if (groupedObservation) {
      observationMap.set(title, [...groupedObservation, observationPoint]);
    } else {
      observationMap.set(title, [observationPoint]);
    }
  });

  Array.from(observationMap.entries()).map(([title, values]) => {
    const sortedPoints = values.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const mostRecent = sortedPoints[sortedPoints.length - 1];
    if (!mostRecent) return;
    results.push({
      title,
      mostRecentObservation: mostRecent.rawLabObs,
      sortedPoints: sortedPoints.map(p => ({
        id: p.id,
        value: p.value,
        numericValue: p.numericValue,
        date: p.date,
        unit: p.unit,
        referenceRange: p.referenceRange,
        interpretation: p.interpretation,
        filename: p.rawLabObs.extension?.find(ext => ext.valueString)?.valueString ?? "",
      })),
    });
  });

  return results;
}

function getGroupedLabsRowData({ labs }: { labs: GroupedLabs[] }): LabRowData[] {
  return labs?.map(lab => {
    const mostRecentPoint = lab.sortedPoints?.[0];
    return {
      id: lab.mostRecentObservation.id ?? "-",
      observation: lab.title,
      date: mostRecentPoint?.date ?? "-",
      value: mostRecentPoint?.value ?? "-",
      interpretation: mostRecentPoint?.interpretation ?? "-",
      referenceRange: mostRecentPoint?.referenceRange ?? "-",
      mostRecentValue: mostRecentPoint?.value ?? "-",
      mostRecentDate: lab.mostRecentObservation.effectiveDateTime
        ? getLabsDate(lab.mostRecentObservation)
        : "-",
      rowColor: getColorForInterpretation(mostRecentPoint?.interpretation),
      originalData: lab.mostRecentObservation,
    };
  });
}
