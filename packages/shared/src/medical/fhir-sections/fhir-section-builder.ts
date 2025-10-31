import { Bundle } from "@medplum/fhirtypes";
import { FhirSection, fhirSections, MappedConsolidatedResources, SectionKey } from ".";

export class FhirSectionBuilder {
  private readonly bundle: Bundle;
  private mappedResources: MappedConsolidatedResources | undefined;
  private skippedSections: Set<string> = new Set();

  constructor(bundle: Bundle) {
    this.bundle = bundle;
  }

  build() {
    this.groupBundleByResourceType();
    return this.createSections();
  }

  groupBundleByResourceType() {
    const mappedResources: MappedConsolidatedResources = {};
    this.bundle.entry?.forEach(entry => {
      const resource = entry.resource;
      if (resource) {
        if (!mappedResources[resource.resourceType]) {
          mappedResources[resource.resourceType] = {};
        }
        const mappedResource = mappedResources[resource.resourceType];
        if (mappedResource && resource.id) {
          mappedResource[resource.id] = resource;
        }
      }
    });
    this.mappedResources = mappedResources;
  }

  createSections() {
    return Object.values(fhirSections)
      .filter(section => this.isValidSection(section))
      .map(section => this.getSectionData(section));
  }

  isValidSection(section: FhirSection): boolean {
    return !!section && !this.skippedSections.has(section.key);
  }

  getSectionData(section: FhirSection) {
    return section.generateTableData({ bundle: this.mappedResources ?? {} });
  }

  skipSection(key: SectionKey): FhirSectionBuilder {
    this.skippedSections.add(key);
    return this;
  }
}
