import { Patient } from "@medplum/fhirtypes";
import { startCase } from "lodash";
import { formatDateForDisplay } from "./shared";

export function createPatientDemographics(patient: Patient): string {
  return `
    <div class="demographics">
      <h2 class="demographics-title">
          Patient Demographics
      </h2>
      <div class="demographics-grid">
          <div class="demographics-item">
              <div class="demographics-icon-wrapper">
                  <i class="fas fa-id-card demographics-icon"></i>
              </div>
              <div class="demographics-content">
                  <span class="demographics-label">Patient ID</span>
                  <span class="demographics-value">${patient.id}</span>
              </div>
          </div>
          <div class="demographics-row">
              <div class="demographics-item">
                  <div class="demographics-icon-wrapper">
                      <i class="fas fa-user demographics-icon"></i>
                  </div>
                  <div class="demographics-content">
                      <span class="demographics-label">Full Name</span>
                      <span class="demographics-value">
                        ${patient.name?.[0]?.given?.[0] ?? ""} ${patient.name?.[0]?.family ?? ""}
                      </span>
                  </div>
              </div>
              <div class="demographics-item">
                  <div class="demographics-icon-wrapper">
                      <i class="fas fa-calendar-alt demographics-icon"></i>
                  </div>
                  <div class="demographics-content">
                      <span class="demographics-label">Date of Birth</span>
                      <span class="demographics-value">
                        ${formatDateForDisplay(patient.birthDate)}
                      </span>
                  </div>
              </div>
          </div>
          <div class="demographics-row">
              <div class="demographics-item">
                  <div class="demographics-icon-wrapper">
                      <i class="fas fa-venus-mars demographics-icon"></i>
                  </div>
                  <div class="demographics-content">
                      <span class="demographics-label">Gender</span>
                      <span class="demographics-value">
                        ${startCase(patient.gender)}
                      </span>
                  </div>
              </div>
              <div class="demographics-item">
                  <div class="demographics-icon-wrapper">
                      <i class="fas fa-home demographics-icon"></i>
                  </div>
                  <div class="demographics-content">
                      <span class="demographics-label">Address</span>
                      <span class="demographics-value">
                        ${patient.address?.[0]?.line?.[0] ?? ""},
                        ${patient.address?.[0]?.city ?? ""},
                        ${patient.address?.[0]?.state ?? ""}
                        ${patient.address?.[0]?.postalCode ?? ""}
                      </span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  `;
}
