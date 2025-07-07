import dayjs from "dayjs";

export interface HistoryData {
  nameId: string;
  events: HistoryEvent[];
}

export interface HistoryEvent {
  date: string;
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
  events.sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));

  const html: string[] = ["<table>"];
  html.push("<thead>");
  html.push("<tr>");
  html.push("<th>Date</th>");
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
    html.push("<td>", dayjs(event.date).format("YYYY-MM-DD"), "</td>");
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
