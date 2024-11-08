import { createSectionHeader } from "../shared/section-header";

export function createAllergiesSections(): string {
  return `
    <div id="allergies" class="section">
      ${createSectionHeader("Allergies", "fa-allergies")}

      <table class="table">
          <thead>
              <tr>
                  <th>Allergy</th>
                  <th>Manifestation</th>
                  <th>First Seen</th>
                  <th>Status</th>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td>Molds & Smuts</td>
                  <td>Hives</td>
                  <td>2021-06-27</td>
                  <td><span class="status-badge">active</span></td>
              </tr>
              <tr>
                  <td>Nuts</td>
                  <td>Sneezing</td>
                  <td>2021-06-27</td>
                  <td><span class="status-badge">active</span></td>
              </tr>
              <tr>
                  <td>Ibuprofen</td>
                  <td>Sores</td>
                  <td>2021-06-27</td>
                  <td><span class="status-badge">active</span></td>
              </tr>
              <tr>
                  <td>Chlorine</td>
                  <td>Rash</td>
                  <td>2021-06-27</td>
                  <td><span class="status-badge">active</span></td>
              </tr>
              <tr>
                  <td>Dust</td>
                  <td>Hives</td>
                  <td>2021-06-27</td>
                  <td><span class="status-badge">active</span></td>
              </tr>
          </tbody>
      </table>
    </div>
  `;
}
