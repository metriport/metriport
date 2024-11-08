import { createSectionHeader } from "../shared/section-header";

export function createVitalsSections(): string {
  return `
    <div id="vitals" class="section">
      ${createSectionHeader("Vitals", "fa-heart")}

      <div class="vitals-grid">
          <div class="vital-card">
              <div class="vital-card-header">Oxygen Saturation (%)</div>
              <div class="vital-card-content">
                  <div class="chart-container">
                      <canvas id="oxygenSaturationChart"></canvas>
                  </div>
              </div>
          </div>

          <div class="vital-card">
              <div class="vital-card-header">Temperature (°C)</div>
              <div class="vital-card-content">
                  <div class="chart-container">
                      <canvas id="temperatureChart"></canvas>
                  </div>
              </div>
          </div>

          <div class="vital-card">
              <div class="vital-card-header">Blood Pressure (mmHg)</div>
              <div class="vital-card-content">
                  <div class="chart-container">
                      <canvas id="bloodPressureChart"></canvas>
                  </div>
              </div>
          </div>

          <div class="vital-card">
              <div class="vital-card-header">Respiratory Rate (per minute)</div>
              <div class="vital-card-content">
                  <div class="chart-container">
                      <canvas id="respiratoryRateChart"></canvas>
                  </div>
              </div>
          </div>

          <div class="vital-card">
              <div class="vital-card-header">Heart Rate (BPM)</div>
              <div class="vital-card-content">
                  <div class="chart-container">
                      <canvas id="heartRateChart"></canvas>
                  </div>
              </div>
          </div>
      </div>
    </div>
  `;
}
