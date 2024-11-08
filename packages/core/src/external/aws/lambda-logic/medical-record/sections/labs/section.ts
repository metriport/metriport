import { createSectionHeader } from "../shared/section-header";

export function createLabsSections(): string {
  return `
    <div id="labs" class="section">
      ${createSectionHeader("Labs", "fa-flask")}

      <div class="lab-panel">
          <h3 class="lab-panel-title">Lab Panel - 2023-07-08</h3>
          <table class="table">
            <thead>
                <tr>
                    <th>Observation</th>
                    <th>Value</th>
                    <th>Interpretation</th>
                    <th>Reference Range</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
                <tr class="result-normal">
                    <td>PYRIDOXAL 5-PHOSPHATE</td>
                    <td>6 mcg/L</td>
                    <td>normal</td>
                    <td>5 - 50 mcg/L</td>
                    <td>2023-10-04</td>
                </tr>
                <tr class="result-normal">
                    <td>MANGANESE</td>
                    <td>0.5 nanogram per milliliter</td>
                    <td>normal</td>
                    <td>0.5 - 1.2 nanogram per milliliter</td>
                    <td>2023-10-04</td>
                </tr>
                <tr>
                    <td>Chromium</td>
                    <td>0.3 nanogram per milliliter</td>
                    <td>-</td>
                    <td><= 0.3 nanogram per milliliter</td>
                    <td>2023-10-04</td>
                </tr>
                <tr class="result-abnormal">
                    <td>Lab Interpretation</td>
                    <td>Abnormal</td>
                    <td>abnormal</td>
                    <td>-</td>
                    <td>2023-10-03</td>
                </tr>
                <tr>
                    <td>Sterile Body Fluid Culture</td>
                    <td>Culture yields no growth.</td>
                    <td>-</td>
                    <td>-</td>
                    <td>2023-10-03</td>
                </tr>
                <tr class="result-abnormal">
                    <td>Iodine, S</td>
                    <td>204 nanogram per milliliter</td>
                    <td>high</td>
                    <td>40 - 92 nanogram per milliliter</td>
                    <td>2023-10-03</td>
                </tr>
                <tr>
                    <td>Anaerobic Culture</td>
                    <td>No anaerobic organisms isolated.</td>
                    <td>-</td>
                    <td>-</td>
                    <td>2023-10-02</td>
                </tr>
                <tr class="result-low">
                    <td>Vitamin A (Retinol)</td>
                    <td>18.5 microgram per deciliter</td>
                    <td>low</td>
                    <td>32.5 - 78 microgram per deciliter</td>
                    <td>2023-10-01</td>
                </tr>
                <tr class="result-normal">
                    <td>Vitamin E (A-Tocopherol)</td>
                    <td>10.2 milligram per liter</td>
                    <td>normal</td>
                    <td>5.5 - 17 milligram per liter</td>
                    <td>2023-10-01</td>
                </tr>
                <tr class="result-normal">
                    <td>Calcium</td>
                    <td>8.6 milligram per deciliter</td>
                    <td>normal</td>
                    <td>8.6 - 10.3 milligram per deciliter</td>
                    <td>2023-09-30</td>
                </tr>
            </tbody>
          </table>
      </div>
    </div>
  `;
}
