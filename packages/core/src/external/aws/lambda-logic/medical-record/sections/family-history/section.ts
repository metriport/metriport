import { createSectionHeader } from "../shared/section-header";

export function createFamilyHistorySections(): string {
  return `
    <div id="family-history" class="section">
      ${createSectionHeader("Family History", "fa-sitemap")}

      <table class="table">
        <thead>
            <tr>
                <th>Family Member</th>
                <th>Sex</th>
                <th>Conditions</th>
                <th>Deceased</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Natural father</td>
                <td>M</td>
                <td>Hypertension, Stroke, Diabetes, Heart disease</td>
                <td>No</td>
            </tr>
            <tr>
                <td>Maternal grandmother</td>
                <td>F</td>
                <td>Hypertension</td>
                <td>No</td>
            </tr>
        </tbody>
      </table>
    </div>
  `;
}
