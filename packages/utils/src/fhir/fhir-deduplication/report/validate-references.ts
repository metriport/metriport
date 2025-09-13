import { Reference, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { csvSeparator } from "./csv";

const missingRefsFileName = "missing-refs.csv";

/**
 * Go through each resource, find other resources it references, and check if they are present in the bundle.
 */
export function lookForBrokenReferences(resources: Resource[], dirName: string): boolean {
  const resourceMap = new Map<string, Resource>();
  resources.forEach(r => resourceMap.set(r.id ?? "", r));

  const missingRefs: { resource: Resource; missingRefs: string[] }[] = [];
  resources.forEach(r => {
    const localMissingRefs = findMissingRefs(r, resourceMap);
    if (localMissingRefs.length) missingRefs.push({ resource: r, missingRefs: localMissingRefs });
  });

  if (missingRefs.length) {
    const outputFileName = dirName + "/" + missingRefsFileName;

    // Check if the file exists, if not, create it with the header
    if (!fs.existsSync(outputFileName)) {
      const header = ["resource", "missing-refs..."].join(csvSeparator);
      fs.writeFileSync(outputFileName, header + "\n");
    }

    console.log(
      `>>> Found ${missingRefs.length} missing references! Appending to the file ${outputFileName}.`
    );

    const lines = missingRefs
      .map(entry => {
        const resource = `${entry.resource.resourceType}/${entry.resource.id}`;
        const missingRefs = entry.missingRefs.join(csvSeparator);
        return resource + csvSeparator + missingRefs;
      })
      .join("\n");

    fs.appendFileSync(outputFileName, lines + "\n");
    return false;
  }
  return true;
}

function findMissingRefs(resource: Resource, resourceMap: Map<string, Resource>): string[] {
  const missingRefs: string[] = [];
  const refs = findRefs(resource);
  refs.forEach(ref => {
    const [resourceType, id] = ref.split("/");
    if (resourceType !== "Patient" && !resourceMap.has(id ?? "")) {
      missingRefs.push(ref);
    }
  });
  return missingRefs;
}

function findRefs<T extends Resource>(resource: T): string[] {
  const refs: string[] = [];

  if ("result" in resource && resource.result) {
    if (Array.isArray(resource.result)) {
      refs.push(...resource.result.flatMap(referenceToArray));
    } else if (typeof resource.result === "object") {
      refs.push(...referenceToArray(resource.result));
    }
  }

  if ("location" in resource && resource.location) {
    if (Array.isArray(resource.location)) {
      if (
        resource.resourceType === "Device" ||
        resource.resourceType === "Immunization" ||
        resource.resourceType === "MedicationDispense" ||
        resource.resourceType === "Procedure" ||
        resource.resourceType === "Provenance" ||
        resource.resourceType === "Task"
      ) {
        refs.push(...referenceToArray(resource.location));
      } else if (resource.resourceType === "Encounter") {
        refs.push(...resource.location.flatMap(l => referenceToArray(l.location)));
      } else if (resource.resourceType === "PractitionerRole") {
        refs.push(...resource.location.flatMap(referenceToArray));
      }
    } else if ("reference" in resource.location) {
      refs.push(...referenceToArray(resource.location));
    }
  }

  if (resource.resourceType === "Medication") {
    refs.push(...(resource.ingredient?.flatMap(i => referenceToArray(i.itemReference)) ?? []));
  }
  if ("diagnosis" in resource && resource.diagnosis) {
    if (resource.resourceType === "Encounter") {
      refs.push(...resource.diagnosis.flatMap(referenceToArray));
    }
  }
  if ("participant" in resource && resource.participant) {
    if (resource.resourceType === "Encounter") {
      refs.push(...resource.participant.flatMap(p => referenceToArray(p.individual)));
    }
  }
  if ("protocolApplied" in resource && resource.protocolApplied) {
    refs.push(...resource.protocolApplied.flatMap(i => referenceToArray(i.authority)));
  }
  if ("qualification" in resource && resource.qualification) {
    refs.push(...resource.qualification.flatMap(i => referenceToArray(i.issuer)));
  }

  if ("reaction" in resource && resource.reaction) {
    refs.push(
      ...resource.reaction.flatMap(p => {
        if ("detail" in p) return p.detail?.reference ?? [];
        return [];
      })
    );
  }

  if ("section" in resource && resource.section) {
    refs.push(...resource.section.flatMap(s => s.entry?.flatMap(referenceToArray) ?? []));
  }
  if ("stage" in resource && resource.stage) {
    refs.push(...resource.stage.flatMap(p => p.assessment?.flatMap(referenceToArray) ?? []));
  }
  if ("evidence" in resource && resource.evidence) {
    refs.push(...resource.evidence.flatMap(p => p.detail?.flatMap(referenceToArray) ?? []));
  }

  if ("partOf" in resource && resource.partOf) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.partOf));
  }
  if ("performer" in resource && resource.performer) {
    if (Array.isArray(resource.performer)) {
      refs.push(
        ...resource.performer.flatMap(p => {
          if ("reference" in p) return p.reference ?? [];
          if ("actor" in p) return p.actor?.reference ?? [];
          if ("onBehalfOf" in p) return p.onBehalfOf?.reference ?? [];
          return [];
        })
      );
    } else {
      refs.push(...referenceToArray(resource.performer));
    }
  }
  if ("focus" in resource && resource.focus) {
    if (Array.isArray(resource.focus)) {
      refs.push(
        ...resource.focus.flatMap(f => {
          if ("reference" in f) return f.reference ?? [];
          return [];
        })
      );
    } else {
      refs.push(...referenceToArray(resource.focus));
    }
  }

  if ("recorder" in resource && resource.recorder) {
    if (Array.isArray(resource.recorder)) {
      refs.push(...resource.recorder.flatMap(referenceToArray));
    } else {
      refs.push(...referenceToArray(resource.recorder));
    }
  }

  if ("context" in resource && resource.context) {
    if (!Array.isArray(resource.context)) {
      refs.push(...referenceToArray(resource.context));
    }
  }

  if ("specimen" in resource && resource.specimen) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.specimen));
  }
  if ("appointment" in resource && resource.appointment) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.appointment));
  }
  if ("subject" in resource && resource.subject) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.subject));
  }
  if ("author" in resource && resource.author) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.author));
  }
  if ("basedOn" in resource && resource.basedOn) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.basedOn));
  }
  if ("device" in resource && resource.device) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.device));
  }
  if ("reasonReference" in resource && resource.reasonReference) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.reasonReference));
  }
  if ("manufacturer" in resource && resource.manufacturer) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.manufacturer));
  }

  if ("request" in resource && resource.request) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.request));
  }
  if ("derivedFrom" in resource && resource.derivedFrom) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.derivedFrom));
  }
  if ("managingOrganization" in resource && resource.managingOrganization) {
    refs.push(...stringReferenceOrArrayToStringArr(resource.managingOrganization));
  }

  if ("patient" in resource && resource.patient) {
    refs.push(...referenceToArray(resource.patient));
  }
  if ("encounter" in resource && resource.encounter) {
    refs.push(...referenceToArray(resource.encounter));
  }
  if ("informationSource" in resource && resource.informationSource) {
    refs.push(...referenceToArray(resource.informationSource));
  }
  if ("medicationReference" in resource && resource.medicationReference) {
    refs.push(...referenceToArray(resource.medicationReference));
  }
  if ("priorPrescription" in resource && resource.priorPrescription) {
    refs.push(...referenceToArray(resource.priorPrescription));
  }
  if ("asserter" in resource && resource.asserter) {
    refs.push(...referenceToArray(resource.asserter));
  }
  if ("hospitalization" in resource && resource.hospitalization) {
    refs.push(...referenceToArray(resource.hospitalization.destination));
  }
  if ("serviceProvider" in resource && resource.serviceProvider) {
    refs.push(...referenceToArray(resource.serviceProvider));
  }
  if ("policyHolder" in resource && resource.policyHolder) {
    refs.push(...referenceToArray(resource.policyHolder));
  }
  if ("beneficiary" in resource && resource.beneficiary) {
    refs.push(...referenceToArray(resource.beneficiary));
  }

  if ("episodeOfCare" in resource && resource.episodeOfCare) {
    refs.push(...resource.episodeOfCare.flatMap(referenceToArray));
  }
  if ("supportingInformation" in resource && resource.supportingInformation) {
    refs.push(...resource.supportingInformation.flatMap(referenceToArray));
  }
  if ("payor" in resource && resource.payor) {
    refs.push(...resource.payor.flatMap(referenceToArray));
  }
  if ("insurance" in resource && resource.insurance) {
    refs.push(...resource.insurance.flatMap(referenceToArray));
  }
  if ("detectedIssue" in resource && resource.detectedIssue) {
    refs.push(...resource.detectedIssue.flatMap(referenceToArray));
  }
  if ("eventHistory" in resource && resource.eventHistory) {
    refs.push(...resource.eventHistory.flatMap(referenceToArray));
  }
  if ("hasMember" in resource && resource.hasMember) {
    refs.push(...resource.hasMember.flatMap(referenceToArray));
  }
  if ("resultsInterpreter" in resource && resource.resultsInterpreter) {
    refs.push(...resource.resultsInterpreter.flatMap(referenceToArray));
  }
  if ("report" in resource && resource.report) {
    refs.push(...resource.report.flatMap(referenceToArray));
  }
  if ("complicationDetail" in resource && resource.complicationDetail) {
    refs.push(...resource.complicationDetail.flatMap(referenceToArray));
  }
  if ("usedReference" in resource && resource.usedReference) {
    refs.push(...resource.usedReference.flatMap(referenceToArray));
  }
  if ("payor" in resource && resource.payor) {
    refs.push(...resource.payor.flatMap(referenceToArray));
  }
  if ("contract" in resource && resource.contract) {
    refs.push(...resource.contract.flatMap(referenceToArray));
  }
  if ("endpoint" in resource && resource.endpoint) {
    refs.push(...resource.endpoint.flatMap(referenceToArray));
  }

  // Check references that point to "contained" and remove them from the list
  if ("contained" in resource && resource.contained) {
    const containedRefs = refs.filter(ref => ref.startsWith("#"));
    if (containedRefs.length) {
      const containedIds = resource.contained.map(c => c.id) ?? [];
      return refs.filter(ref => !containedIds.includes(ref.slice(1)));
    }
  }

  return refs;
}

function referenceToArray(ref?: Reference): string[] {
  return [ref?.reference ?? []].flat();
}

function stringReferenceOrArrayToStringArr(
  obj?: string | string[] | Reference | Reference[]
): string[] {
  if (typeof obj === "string") {
    return [obj];
  } else if (Array.isArray(obj)) {
    return obj.flatMap(stringReferenceOrArrayToStringArr);
  } else {
    return referenceToArray(obj);
  }
}
