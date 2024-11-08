import { createSectionHeader } from "../shared/section-header";

export function createEncountersSections(): string {
  return `
    <div id="encounters" class="section">
      ${createSectionHeader("Encounters", "fa-hospital")}

      <table class="table">
          <thead>
              <tr>
                  <th>Type</th>
                  <th>Location</th>
                  <th class="sort-icon">Start Date</th>
                  <th>End Date</th>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td>inpatient</td>
                  <td>UH 7A1 GEN MED</td>
                  <td>2024-09-05</td>
                  <td>2024-09-06</td>
              </tr>
              <tr>
                  <td>outpatient</td>
                  <td>UH 7A1 GEN MED</td>
                  <td>2024-09-04</td>
                  <td>2024-09-04</td>
              </tr>
              <tr>
                  <td>inpatient</td>
                  <td>UH 7A1 GEN MED</td>
                  <td>2023-09-22</td>
                  <td>2023-09-30</td>
              </tr>
              <tr>
                  <td>inpatient</td>
                  <td>MARY FREE BED AT SPARROW</td>
                  <td>2023-09-20</td>
                  <td>2023-10-03</td>
              </tr>
          </tbody>
      </table>
    </div>
  `;
}
