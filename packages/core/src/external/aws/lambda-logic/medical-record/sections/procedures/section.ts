import { createSectionHeader } from "../shared/section-header";

export function createProceduresSections(): string {
  return `
    <div id="procedures" class="section">
      ${createSectionHeader("Procedures", "fa-procedures")}

      <table class="table">
          <thead>
              <tr>
                  <th>Procedure</th>
                  <th>Date Performed</th>
                  <th>Status</th>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td>HC MAGNESIUM - MAGNESIUM</td>
                  <td>2024-07-07</td>
                  <td><span class="status-badge">completed</span></td>
              </tr>
              <tr>
                  <td>HC 12 LEAD EKG; TRACING ONLY - ECG 12-LEAD</td>
                  <td>2024-07-06</td>
                  <td><span class="status-badge">completed</span></td>
              </tr>
              <tr>
                  <td>FUNGAL CULTURE, NON-BLOOD</td>
                  <td>2023-09-28</td>
                  <td><span class="status-badge">completed</span></td>
              </tr>
              <tr>
                  <td>HC-XR CHEST 1 VIEW; XR CHEST PORTABLE 1 VIEW</td>
                  <td>2023-09-26</td>
                  <td><span class="status-badge">completed</span></td>
              </tr>
              <tr>
                  <td>BASIC METABOLIC PANEL</td>
                  <td>2023-09-24</td>
                  <td><span class="status-badge">completed</span></td>
              </tr>
              <tr>
                  <td>STERILE BODY FLUID CULTURE, AEROBIC</td>
                  <td>2023-09-23</td>
                  <td><span class="status-badge">completed</span></td>
              </tr>
              <tr>
                  <td>ESTIMATED GLOMERULAR FILTRATION RATE</td>
                  <td>2023-09-22</td>
                  <td><span class="status-badge">completed</span></td>
              </tr>
              <tr>
                  <td>X-RAY SHOULDER 2+ VW - XR SHOULDER 2+ VIEWS</td>
                  <td>2016-05-17</td>
                  <td><span class="status-badge">completed</span></td>
              </tr>
          </tbody>
      </table>
    </div>
  `;
}
