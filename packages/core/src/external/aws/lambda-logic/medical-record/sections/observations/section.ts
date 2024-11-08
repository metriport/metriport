import { createSectionHeader } from "../shared/section-header";

export function createObservationsSections(): string {
  return `
    <div id="observations" class="section">
      ${createSectionHeader("Observations", "fa-eye")}

      <table class="table">
          <thead>
              <tr>
                  <th>Observation</th>
                  <th>Value</th>
                  <th>Date</th>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td>Patient Visit City, Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]</td>
                  <td>11 score</td>
                  <td>2016-09-22</td>
              </tr>
              <tr>
                  <td>Patient At Home Visit</td>
                  <td>11 score</td>
                  <td>2016-06-22</td>
              </tr>
              <tr>
                  <td>Patient At Home Visit</td>
                  <td>11 score</td>
                  <td>2016-03-22</td>
              </tr>
          </tbody>
      </table>
    </div>
  `;
}
