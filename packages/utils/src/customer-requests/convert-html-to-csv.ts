import { DOMParser } from "xmldom";

// This is temporary function that will eventually be introduced
// as another way to render patient data. (Will need refactoring)
export function convertHtmlTablesToCsv(html: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  const sections = document.getElementsByClassName("section");

  const csvData = [];

  for (let i = 0; i < sections.length; i++) {
    const sectionData = [];
    const section = sections[i];
    const sectionTitle = section.getElementsByTagName("h3")[0].attributes[0].value;

    const tables = section.getElementsByTagName("table");

    if (tables.length === 0) {
      continue;
    }

    if (tables.length === 1) {
      const table = tables[0];

      const columnData = [];
      const columns = table.getElementsByTagName("th");

      for (let j = 0; j < columns.length; j++) {
        columnData.push(columns[j].textContent);
      }

      const rowsData = [];
      const rows = table.getElementsByTagName("tr");

      for (let j = 1; j < rows.length; j++) {
        const rowData = [];
        const row = rows[j].getElementsByTagName("td");

        for (let k = 0; k < row.length; k++) {
          rowData.push(row[k].textContent?.replaceAll(",", " - "));
        }

        rowsData.push(rowData.join(","));
      }

      sectionData.push(sectionTitle);
      sectionData.push(columnData.join(","));
      sectionData.push(rowsData.join("\n"));
    } else {
      const tableData = [];

      for (let j = 0; j < tables.length; j++) {
        const table = tables[j];
        const subsectionTitle = table.getElementsByTagName("h4")[0]?.textContent || "";

        const columnData = [];
        const columns = table.getElementsByTagName("th");

        for (let k = 0; k < columns.length; k++) {
          columnData.push(columns[k].textContent);
        }

        const rowsData = [];
        const rows = table.getElementsByTagName("tr");

        for (let k = 1; k < rows.length; k++) {
          const rowData = [];
          const row = rows[k].getElementsByTagName("td");

          for (let l = 0; l < row.length; l++) {
            rowData.push(row[l].textContent?.replaceAll(",", " - "));
          }

          rowsData.push(rowData.join(","));
        }

        tableData.push(subsectionTitle);
        tableData.push(columnData.join(","));
        tableData.push(rowsData.join("\n"));
      }

      sectionData.push(sectionTitle);
      sectionData.push(tableData.join("\n"));
    }

    csvData.push(sectionData.join("\n"));
  }

  const joinedCsvData = csvData.join("\n\n");

  const headerTablePatient = document.getElementsByClassName("header-table-patient");
  const headerPatient = headerTablePatient[0];
  const headerLables = headerPatient.getElementsByTagName("span");
  let patientName = "";
  let patientId = "";

  for (let i = 0; i < headerLables.length; i++) {
    if (headerLables[i].textContent === "Name") {
      patientName = headerLables[i + 1].textContent?.trim() || "";
    }

    if (headerLables[i].textContent === "ID") {
      patientId = headerLables[i + 1].textContent?.trim() || "";
    }
  }

  const convertedCsv =
    `Patient Name: ${patientName}\nPatient ID: ${patientId}\n\n` + joinedCsvData;

  return convertedCsv;
}