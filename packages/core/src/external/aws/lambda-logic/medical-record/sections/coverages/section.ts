import { createSectionHeader } from "../shared/section-header";

export function createCoveragesSections(): string {
  return `
    <div id="coverages" class="section">
      ${createSectionHeader("Coverages", "fa-file-medical")}

      <table class="table">
        <thead>
            <tr>
                <th>Provider</th>
                <th>Policy Id</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>SIGMA MEDICARE, INC</td>
                <td>112233445566</td>
                <td>active</td>
            </tr>
        </tbody>
      </table>
    </div>
  `;
}
