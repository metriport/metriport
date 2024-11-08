import { createSectionHeader } from "../shared/section-header";

export function createConditionsSections(): string {
  return `
    <div id="conditions" class="section">
      ${createSectionHeader("Conditions", "fa-heartbeat")}

      <table class="table">
        <thead>
            <tr>
                <th>Condition</th>
                <th>Code</th>
                <th>First seen</th>
                <th>Last seen</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Hypomagnesemia</td>
                <td class="code">SNOMED: 190855004</td>
                <td>2024-08-27</td>
                <td>2024-08-27</td>
            </tr>
            <tr>
                <td>Acute systolic congestive heart failure (CMS/HCC)</td>
                <td class="code">SNOMED: 443254009</td>
                <td>2023-11-13</td>
                <td></td>
            </tr>
            <tr>
                <td>Sinus tarsi syndrome of left ankle</td>
                <td class="code">SNOMED: 15742281000119102</td>
                <td>2023-11-13</td>
                <td></td>
            </tr>
        </tbody>
    </table>
    </div>
  `;
}
