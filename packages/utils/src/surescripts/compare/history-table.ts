import { buildDayjs } from "@metriport/shared/common/date";

export interface HistoryData {
  nameId: string;
  events: HistoryEvent[];
}

export interface HistoryEvent {
  dateWritten: string;
  soldDate: string;
  medicationName: string;
  medicationNdc: string;
  daysSupply?: string | number;
  directions?: string;
  pharmacyName?: string;
}

export function historyPage({ nameId, events }: HistoryData): string {
  const html: string[] = ["<html><head><title>", nameId, "</title></head><body>"];
  html.push(historyTable(events));
  html.push("</body></html>");
  return html.join("");
}

export function historyTable(events: HistoryEvent[]): string {
  events.sort((a, b) => {
    const dateDiff = buildDayjs(a.soldDate).diff(buildDayjs(b.soldDate));
    if (dateDiff === 0) {
      return a.medicationName.localeCompare(b.medicationName);
    }
    return dateDiff;
  });

  const html: string[] = ["<table>"];
  html.push("<thead>");
  html.push("<tr>");
  html.push("<th>Date Written</th>");
  html.push("<th>Sold Date</th>");
  html.push("<th>Medication Name</th>");
  html.push("<th>Medication NDC</th>");
  html.push("<th>Days Supply</th>");
  html.push("<th>Directions</th>");
  html.push("<th>Pharmacy Name</th>");
  html.push("</tr>");
  html.push("</thead>");

  html.push("<tbody>");
  events.forEach(event => {
    html.push("<tr>");
    html.push("<td>", buildDayjs(event.dateWritten).format("YYYY-MM-DD"), "</td>");
    html.push("<td>", buildDayjs(event.soldDate).format("YYYY-MM-DD"), "</td>");
    html.push("<td>", event.medicationName, "</td>");
    html.push("<td>", event.medicationNdc, "</td>");
    html.push("<td>", event.daysSupply ? event.daysSupply.toString() : "", "</td>");
    html.push("<td>", event.directions ?? "", "</td>");
    html.push("<td>", event.pharmacyName ?? "", "</td>");
    html.push("</tr>");
  });
  html.push("</tbody>");

  html.push("</table>");
  return html.join("");
}
