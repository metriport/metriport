import { createSectionHeader } from "../shared/section-header";

export function createMedicationsSections(): string {
  return `
    <div id="medications" class="section">
    ${createSectionHeader("Medications", "fa-pills")}

      <table class="table">
          <thead>
              <tr>
                  <th>Medication</th>
                  <th>Dosage</th>
                  <th>Route</th>
                  <th>Status</th>
              </tr>
          </thead>
          <tbody>
              <tr class="main-row">
                  <td>
                      <span class="main-name">oxyCODONE-acetaminophen (PERCOCET) 5-325 mg tablet</span>
                  </td>
                  <td>1 {tbl}</td>
                  <td>Oral</td>
                  <td>
                      <span class="status-badge">completed</span>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2024-04-24</span>
                          </div>
                          <div class="history-event">
                              Documented: 1 tablet, Oral, Once, Post-op. Indication: Pain
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2024-04-23</span>
                          </div>
                          <div class="history-event">
                              Administered: 1 {tbl}, Oral
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2021-08-03</span>
                          </div>
                          <div class="history-event">
                              Administered: 1 {tbl}, Oral
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2021-08-01</span>
                          </div>
                          <div class="history-event">
                              Documented: Starting at 0938, 1 dose, Created by cabinet override
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="main-row">
                  <td>
                      <span class="main-name">Lisinopril 10 mg tablet</span>
                  </td>
                  <td>1 tablet</td>
                  <td>Oral</td>
                  <td>
                      <span class="status-badge">active</span>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2024-05-01</span>
                          </div>
                          <div class="history-event">
                              Documented: Take 1 tablet by mouth once daily. Indication: Hypertension
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2023-11-15</span>
                          </div>
                          <div class="history-event">
                              Prescription Renewed: 12 months by Dr. Jane Smith
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="main-row">
                  <td>
                      <span class="main-name">Metformin 500 mg tablet</span>
                  </td>
                  <td>1 tablet</td>
                  <td>Oral</td>
                  <td>
                      <span class="status-badge">active</span>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2024-03-15</span>
                          </div>
                          <div class="history-event">
                              Documented: Take 1 tablet by mouth twice daily with meals. Indication: Type 2 Diabetes
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2023-09-20</span>
                          </div>
                          <div class="history-event">
                              Dosage Adjusted: Increased from once daily to twice daily
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2023-06-01</span>
                          </div>
                          <div class="history-event">
                              Medication Started: 1 tablet once daily, Dr. Michael Johnson
                          </div>
                      </div>
                  </td>
              </tr>
          </tbody>
      </table>
    </div>
  `;
}
