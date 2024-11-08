import { createSectionHeader } from "../shared/section-header";

export function createNotesSections(): string {
  return `
    <div id="notes" class="section">
      ${createSectionHeader("Notes", "fa-sticky-note")}

      <div class="note">
        <div class="note-header">
          <div class="note-location">
            <i class="fas fa-map-marker-alt"></i>
            UH 7A1 GEN MED
          </div>
          <h3 class="note-title">Telephone Encounter Note</h3>
          <div class="note-meta">
            <div class="provider-avatar">
              <i class="fas fa-user-md"></i>
            </div>
            <span>David Smith</span>
            <span>•</span>
            <span>09/06/2024 2:25 PM EDT</span>
          </div>
        </div>

        <div class="note-content">
          <div class="note-text">
            Left patient VM for David Smith to discuss starting Farxiga 10 mg daily,
            given his symptoms of leg swelling at last appointment. Asked David
            Smith to return our call to our office number, 123-123-1234.
          </div>

          <div class="note-plan">
            <div class="note-plan-title">Plan:</div>
            <ul class="note-plan-list">
              <li class="note-plan-item">
                Remind patient to get blood work that was ordered by Dr. Smith
              </li>
              <li class="note-plan-item">
                START Farxiga 10 mg daily for optimization of GDMT. Discussed with
                Dr. Smith, which is okay to start now.
              </li>
              <li class="note-plan-item">
                Once pending blood work results and remain stable, will plan to
                increase Entresto to mid dose.
              </li>
            </ul>
          </div>
        </div>

        <div class="diagnosis-box">
          <div class="diagnosis-title">Outcome Diagnosis:</div>
          <ul class="diagnosis-list">
            <li class="diagnosis-item">Congestive Heart Failure</li>
            <li class="diagnosis-item">Peripheral Edema</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}
