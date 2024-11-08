import { Filter, FilterSectionsKeys } from "./shared";
import { startCase, kebabCase } from "lodash";

const keyToIcon: Record<FilterSectionsKeys, string> = {
  [FilterSectionsKeys.notes]: "fa-sticky-note",
  [FilterSectionsKeys.conditions]: "fa-heartbeat",
  [FilterSectionsKeys.medications]: "fa-pills",
  [FilterSectionsKeys.allergies]: "fa-allergies",
  [FilterSectionsKeys.procedures]: "fa-procedures",
  [FilterSectionsKeys.socialHistory]: "fa-users",
  [FilterSectionsKeys.vitals]: "fa-heart",
  [FilterSectionsKeys.labs]: "fa-flask",
  [FilterSectionsKeys.observations]: "fa-eye",
  [FilterSectionsKeys.immunizations]: "fa-syringe",
  [FilterSectionsKeys.familyMemberHistories]: "fa-sitemap",
  [FilterSectionsKeys.relatedPersons]: "fa-user-friends",
  [FilterSectionsKeys.coverages]: "fa-file-medical",
  [FilterSectionsKeys.encounters]: "fa-hospital",
};

export function tableOfContents(filters: Filter[]): string {
  return `
    <div class="toc">
        <h2 class="toc-title">Sections</h2>
        <div class="toc-grid">
            ${filters
              .map(filter => {
                return `
                <a href="#${kebabCase(filter.key)}" class="toc-item">
                    <span class="toc-icon"><i class="fas ${keyToIcon[filter.key]}"></i></span>
                    <span class="toc-text">${filter.customTitle ?? startCase(filter.key)}</span>
                </a>
              `;
              })
              .join("")}
        </div>
    </div>
  `;
}
