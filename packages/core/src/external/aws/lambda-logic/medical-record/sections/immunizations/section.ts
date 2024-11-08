import { createSectionHeader } from "../shared/section-header";

export function createImmunizationsSections(): string {
  return `
    <div id="immunizations" class="section">
      ${createSectionHeader("Immunizations", "fa-syringe")}

      <table class="table">
        <thead>
            <tr>
                <th>Immunization</th>
                <th>Code</th>
                <th>Manufacturer</th>
                <th class="sort-icon">Date</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Influenza, injectable, quadrivalent, preservative free, pediatric,...</td>
                <td>CVX: 161</td>
                <td>-</td>
                <td>2018-10-01</td>
                <td>completed</td>
            </tr>
            <tr>
                <td>Hep A, pediatric, 2 dose, Hep A, pediatric, 2 dose</td>
                <td>CVX: 83</td>
                <td>-</td>
                <td>2018-02-12</td>
                <td>completed</td>
            </tr>
            <tr>
                <td>DTaP, 5 pertussis antigens, DTaP, 5 pertussis antigens</td>
                <td>CVX: 106</td>
                <td>-</td>
                <td>2017-12-03</td>
                <td>completed</td>
            </tr>
            <tr>
                <td>Hib (PRP-T), Hib (PRP-T)</td>
                <td>CVX: 48</td>
                <td>-</td>
                <td>2017-12-03</td>
                <td>completed</td>
            </tr>
            <tr>
                <td>MMR, MMR</td>
                <td>CVX: 03</td>
                <td>-</td>
                <td>2017-07-23</td>
                <td>completed</td>
            </tr>
            <tr>
                <td>Pneumococcal conjugate PCV 13, Pneumococcal conjugate P...</td>
                <td>CVX: 133</td>
                <td>-</td>
                <td>2017-07-23</td>
                <td>completed</td>
            </tr>
            <tr>
                <td>DTaP-Hib-IPV, DTaP-Hib-IPV</td>
                <td>CVX: 120</td>
                <td>-</td>
                <td>2016-12-26</td>
                <td>completed</td>
            </tr>
            <tr>
                <td>Hep B, adolescent or pediatric, Hep B, adolescent or pediatric</td>
                <td>CVX: 08</td>
                <td>-</td>
                <td>2016-12-26</td>
                <td>completed</td>
            </tr>
        </tbody>
      </table>
    </div>
  `;
}
