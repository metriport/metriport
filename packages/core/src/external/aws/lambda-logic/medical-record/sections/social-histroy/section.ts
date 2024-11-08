import { createSectionHeader } from "../shared/section-header";

export function createSocialHistorySections(): string {
  return `
    <div id="social-history" class="section">
      ${createSectionHeader("Social History", "fa-users")}

      <table class="table">
          <thead>
              <tr>
                  <th>Observation</th>
                  <th>Value</th>
                  <th>Date</th>
              </tr>
          </thead>
          <tbody>
              <tr class="main-row">
                  <td>
                      <span class="main-name">History of sexual behavior</span>
                  </td>
                  <td>Sexually active</td>
                  <td>2021-07-30</td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2020-03-15</span>
                          </div>
                          <div class="history-event">
                              Not sexually active
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2020-03-15</span>
                          </div>
                          <div class="history-event">
                              Not sexually active
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2020-03-15</span>
                          </div>
                          <div class="history-event">
                              Not sexually active
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="main-row">
                  <td>
                      <span class="main-name">History of sexual behavior</span>
                  </td>
                  <td>Sexually active</td>
                  <td>2021-07-30</td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2020-03-15</span>
                          </div>
                          <div class="history-event">
                              Not sexually active
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2020-03-15</span>
                          </div>
                          <div class="history-event">
                              Not sexually active
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2020-03-15</span>
                          </div>
                          <div class="history-event">
                              Not sexually active
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="main-row">
                  <td>
                      <span class="main-name">History of sexual behavior</span>
                  </td>
                  <td>Sexually active</td>
                  <td>2021-07-30</td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2020-03-15</span>
                          </div>
                          <div class="history-event">
                              Not sexually active
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2020-03-15</span>
                          </div>
                          <div class="history-event">
                              Not sexually active
                          </div>
                      </div>
                  </td>
              </tr>
              <tr class="history-row">
                  <td colspan="4">
                      <div class="history-content">
                          <div class="history-date">
                              <span class="timeline-date">2020-03-15</span>
                          </div>
                          <div class="history-event">
                              Not sexually active
                          </div>
                      </div>
                  </td>
              </tr>
          </tbody>
      </table>
    </div>
  `;
}
