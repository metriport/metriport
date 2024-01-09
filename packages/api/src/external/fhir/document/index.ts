import {
  Address,
  Coding,
  Device,
  DocumentReference,
  DocumentReferenceContent,
  Extension,
  HumanName,
  Identifier,
  Organization,
  Patient as PatientFHIR,
  Practitioner,
  PractitionerRole,
  Reference,
  RelatedPerson,
  Resource,
} from "@medplum/fhirtypes";
import {
  Contained,
  DocumentContent,
  DocumentIdentifier as CWDocumentIdentifier,
  DocumentIdentifier,
  GenderCodes,
  HumanName as CWHumanName,
} from "@metriport/commonwell-sdk";
import { Gender } from "@metriport/commonwell-sdk/src/models/demographics";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import { sortBy, uniqBy } from "lodash";
import { joinName, Patient, splitName } from "@metriport/core/domain/medical/patient";
import MetriportError from "../../../errors/metriport-error";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { CWDocumentWithMetriportData } from "../../commonwell/document/shared";
import { cwExtension } from "../../commonwell/extension";
import { metriportDataSourceExtension } from "../shared/extensions/metriport";
import { toFHIRSubject } from "@metriport/core/external/fhir/patient";
dayjs.extend(isToday);

export const MAX_FHIR_DOC_ID_LENGTH = 64;

export type DocumentReferenceWithId = DocumentReference & Required<Pick<DocumentReference, "id">>;

type AuthorTypes =
  | Device
  | Organization
  | PatientFHIR
  | Practitioner
  | PractitionerRole
  | RelatedPerson;
const authorTypesMap: Record<AuthorTypes["resourceType"], AuthorTypes["resourceType"]> = {
  Device: "Device",
  Organization: "Organization",
  Patient: "Patient",
  Practitioner: "Practitioner",
  PractitionerRole: "PractitionerRole",
  RelatedPerson: "RelatedPerson",
};
const authorTypes = Object.values(authorTypesMap);

// HIEs probably don't have records before the year 1800 :)
const earliestPossibleYear = 1800;

export function getBestDateFromCWDocRef(content: DocumentContent): string {
  const date = dayjs(content.indexed);
  const period = content.context.period;
  // if the timestamp from CW for the indexed date is from today, this usually
  // means that the timestamp is auto-generated, and there may be a more accurate
  // timestamp in the doc ref.
  if (date.isToday() && (period?.start || period?.end)) {
    const newDate = period.start ? dayjs(period.start) : dayjs(period.end);
    // this check is necessary to prevent using weird dates... seen stuff like
    // this before:  "period": { "start": "0001-01-01T00:00:00Z" }
    if (newDate.year() >= earliestPossibleYear) return newDate.toISOString();
  }
  return date.toISOString();
}

export const toFHIR = (
  docId: string,
  doc: CWDocumentWithMetriportData,
  patient: Pick<Patient, "id">
): DocumentReferenceWithId => {
  const content = doc.content;
  const baseAttachment = {
    contentType: doc.metriport.fileContentType,
    fileName: doc.metriport.fileName, // no filename on CW doc refs
    size: doc.metriport.fileSize != null ? doc.metriport.fileSize : content.size, // can't trust the file size from CW, use what we actually saved
    creation: content.indexed,
    format: content.format,
  };

  const metriportFHIRContent = createDocReferenceContent({
    ...baseAttachment,
    location: doc.metriport.location,
    extension: [metriportDataSourceExtension],
  });

  const cwFHIRContent = content.location
    ? createDocReferenceContent({
        ...baseAttachment,
        location: content.location,
        extension: [cwExtension],
      })
    : undefined;

  // https://www.hl7.org/fhir/R4/domainresource-definitions.html#DomainResource.contained
  const containedContent: Resource[] = [];

  const contained = content.contained;
  if (contained?.length) {
    contained.forEach(cwResource => {
      const fhirResource = convertToFHIRResource(cwResource, patient.id, content.subject.reference);
      if (fhirResource) containedContent.push(...fhirResource);
    });
  }

  const author = getAuthors(content, containedContent, docId);
  const date = getBestDateFromCWDocRef(content);
  const status = cwStatusToFHIR(content.status);

  return getFHIRDocRef(patient.id, {
    id: docId,
    contained: containedContent,
    masterIdentifier: {
      system: content.masterIdentifier?.system,
      value: content.masterIdentifier?.value,
    },
    identifier: content.identifier?.map(idToFHIR),
    date,
    status,
    type: content.type,
    author,
    description: content.description,
    content: [metriportFHIRContent, ...(cwFHIRContent ? [cwFHIRContent] : [])],
    extension: [cwExtension],
    context: content.context,
  });
};

export function getFHIRDocRef(
  patientId: string,
  {
    id,
    contained,
    masterIdentifier,
    identifier,
    date,
    status,
    type,
    author,
    description,
    content,
    extension,
    context,
  }: {
    id: string;
    contained: Resource[];
    masterIdentifier: Identifier;
    identifier?: Identifier[];
    date: string;
    status: DocumentReference["status"];
    type: DocumentReference["type"];
    author: Reference<AuthorTypes>[];
    description?: string;
    content: [DocumentReferenceContent, ...DocumentReferenceContent[]];
    extension: [Extension, ...Extension[]];
    context: DocumentReference["context"];
  }
): DocumentReferenceWithId {
  return {
    id,
    resourceType: "DocumentReference",
    contained,
    masterIdentifier,
    identifier,
    date,
    status,
    type,
    subject: toFHIRSubject(patientId),
    author,
    description,
    content,
    extension,
    context,
  };
}

export function cwStatusToFHIR(status: DocumentContent["status"]): DocumentReference["status"] {
  switch (status) {
    case "current":
      return "current";
    case "entered in error":
      return "entered-in-error";
    case "superceded":
      return "superseded";
    default:
      return undefined;
  }
}

export function createDocReferenceContent({
  contentType,
  size,
  fileName,
  location,
  creation,
  extension,
  format,
}: {
  contentType?: string;
  size?: number;
  fileName: string;
  location: string;
  creation: string;
  extension: Extension[];
  format?: string | string[];
}): DocumentReferenceContent {
  const content: DocumentReferenceContent = {
    attachment: {
      contentType,
      size,
      creation,
      title: fileName,
      url: location,
    },
    format: getFormat(format),
    extension,
  };

  return content;
}

function getFormat(format: string | string[] | undefined): Coding | undefined {
  const code = getFormatCode(format);
  if (!code) return undefined;
  return { code };
}
function getFormatCode(format: string | string[] | undefined): string | undefined {
  if (!format) return undefined;
  if (typeof format === "string") return format;
  if (format.length < 1) return undefined;
  if (format.length > 1) {
    capture.message(`Found multiple formats on a docRef`, { extra: { format } });
  }
  return format[0];
}

// TODO once we merge DocumentIdentifier with Identifier on CW SDK, let's move this to
// an identifier-specific file
export function idToFHIR(id: DocumentIdentifier): Identifier {
  return {
    system: id.system,
    value: id.value,
    use: id.use === "unspecified" ? undefined : id.use,
  };
}

/**
 * Takes a CW resource and converts it to a FHIR resource.
 *
 * @param resource CW Contained resource.
 * @param patientId Patient ID that the document is associated with.
 * @param subjectRef The subject reference on the CW payload.
 * @returns FHIR Resource; otherwise sends a notification to Sentry if the resource type is not handled.
 */
export function convertToFHIRResource(
  resource: Contained,
  patientId: string,
  subjectRef: string
): Resource[] | undefined {
  const { log } = Util.out(`convertToFHIRResource - patient ${patientId}`);

  if (resource.resourceType === "Patient") {
    return containedPatientToFHIRResource(resource, patientId, subjectRef, log);
  }
  if (resource.resourceType === "Organization") {
    return containedOrgToFHIRResource(resource, patientId, log);
  }
  if (resource.resourceType === "Practitioner") {
    return containedPractitionerToFHIRResource(resource, patientId, log);
  }
  if (resource.resourceType) {
    const msg = `New Resource type on toFHIR conversion - might need to handle in CW doc ref mapping`;
    log(`${msg}: ${JSON.stringify(resource)}`);
    capture.message(msg, {
      extra: {
        context: `toFHIR.convertToFHIRResource`,
        resource,
        patientId,
      },
    });
  }
  return undefined;
}

export function containedPatientToFHIRResource(
  resource: Contained, // it didn't work to set the type to Patient here: `& { resourceType: "Patient" }`
  patientId: string,
  cwSubjectRef: string,
  log: (msg: string) => void
): Resource[] | undefined {
  if (resource.resourceType !== "Patient") {
    const msg = "Contained resource is not a Patient";
    log(`${msg} [containedPatientToFHIRResource] resource: - ${JSON.stringify(resource)}`);
    throw new MetriportError(msg, undefined, { patientId });
  }
  if (!resource.name) {
    log(`Patient with no name, skipping it: ${JSON.stringify(resource)}`);
    return undefined;
  }
  // If the resource ID is the same as CW's subject, use the FHIR patient ID so we can "link" them later
  const chosenResourceId =
    resource.id && cwSubjectRef.includes(resource.id) ? patientId : resource.id ?? undefined;
  if (chosenResourceId !== patientId) {
    const msg = `Found a Patient resource with a different ID`;
    log(`${msg}, chosenResourceId ${chosenResourceId}, resource: - ${JSON.stringify(resource)}`);
    capture.message(msg, {
      extra: { context: `toFHIR.convertToFHIRResource`, resource, patientId, level: "warning" },
    });
  }
  return [
    {
      resourceType: "Patient",
      id: chosenResourceId,
      address: convertCWAdressToFHIR(resource.address),
      gender: convertCWGenderToFHIR(resource.gender?.coding),
      identifier: convertCWIdentifierToFHIR(resource.identifier),
      name: convertCWNameToHumanName(resource.name),
    },
  ];
}

export function containedOrgToFHIRResource(
  resource: Contained,
  patientId: string,
  log: (msg: string) => void
): Resource[] | undefined {
  if (resource.resourceType !== "Organization") {
    const msg = "Contained resource is not a Organization";
    log(`${msg} [containedOrgToFHIRResource] resource: - ${JSON.stringify(resource)}`);
    throw new MetriportError(msg, undefined, { patientId });
  }
  if (!resource.name) {
    log(`Organization with no name, skipping it: ${JSON.stringify(resource)}`);
    return undefined;
  }
  return [
    {
      resourceType: "Organization",
      id: resource.id ?? undefined,
      identifier: convertCWIdentifierToFHIR(resource.identifier),
      name: convertCWNameToString(resource.name),
      address: convertCWAdressToFHIR(resource.address),
    },
  ];
}

export function containedPractitionerToFHIRResource(
  resource: Contained,
  patientId: string,
  log: (msg: string) => void
): Resource[] | undefined {
  if (resource.resourceType !== "Practitioner") {
    const msg = "Contained resource is not a Practitioner";
    log(`${msg} [containedPractitionerToFHIRResource] resource: - ${JSON.stringify(resource)}`);
    throw new MetriportError(msg, undefined, { patientId });
  }
  if (!resource.name) {
    log(`Practitioner with no name, skipping it: ${JSON.stringify(resource)}`);
    return undefined;
  }
  const practitioner: Resource = {
    resourceType: "Practitioner",
    id: resource.id ?? undefined,
    identifier: convertCWIdentifierToFHIR(resource.identifier),
    name: convertCWNameToHumanName(resource.name),
    gender: convertCWGenderToFHIR(resource.gender?.coding),
  };
  const role: Resource | undefined =
    resource.organization?.reference && resource.id
      ? {
          resourceType: "PractitionerRole",
          organization: {
            type: "Organization",
            reference: resource.organization.reference,
          },
          practitioner: {
            type: "Practitioner",
            reference: `#${resource.id}`,
          },
        }
      : undefined;
  return [practitioner, ...(role ? [role] : [])];
}

/**
 * Converts a CW name to a string.
 *
 * @param name One of the CW name types.
 * @returns a space-separated name string; otherwise undefined if a valid name cannot be determined.
 */
function convertCWNameToString(name: string | CWHumanName | CWHumanName[]): string | undefined {
  if (typeof name === "string") {
    return name;
  } else if (Array.isArray(name)) {
    if (name.length) {
      const names: string[] = [];
      name.forEach(n => {
        if (typeof n === "string") {
          names.push(n);
        } else if (typeof n === "object") {
          const humanNames = getHumanNamesFromObject(n).map(n => n.family);
          if (humanNames) names.push(humanNames.join(" "));
        }
      });
      return names.join(" ");
    }
  } else if (typeof name === "object") {
    return getHumanNamesFromObject(name)
      .map(n => n.family)
      .join(" ");
  }
}

/**
 * Converts a CW name to a FHIR HumanName.
 *
 * @param name One of the CW name types.
 * @returns FHIR-compliant HumanName[]; otherwise undefined if a valid name cannot be determined.
 */
function convertCWNameToHumanName(
  name: string | CWHumanName | CWHumanName[] | undefined | null
): HumanName[] | undefined {
  if (!name) return undefined;
  if (typeof name === "string") {
    return [
      {
        family: name,
      },
    ];
  } else if (Array.isArray(name)) {
    if (name.length) {
      let names: HumanName[] = [];
      name.forEach(n => {
        if (typeof n === "string") {
          names.push({
            family: n,
          });
        } else if (typeof n === "object") {
          names = getHumanNamesFromObject(n);
        }
      });
      return names;
    }
  } else if (typeof name === "object") {
    return getHumanNamesFromObject(name);
  }
  return undefined;
}

/**
 * Converts a CW HumanName to a FHIR HumanName.
 *
 * @param name CW HumanName.
 * @returns FHIR-compliant HumanName[]; otherwise undefined if a valid name cannot be determined.
 */
function getHumanNamesFromObject(name: CWHumanName): HumanName[] {
  const names: HumanName[] = [];
  if (name.use === "unspecified") return names;

  const namePrefix = getHumanNameAttribute(name.prefix);
  const nameSuffix = getHumanNameAttribute(name.suffix);

  names.push({
    family: joinName(name.family),
    given: name.given,
    prefix: namePrefix,
    suffix: nameSuffix,
    text: name.text ?? undefined,
  });
  return names;
}

/**
 * Converts a CW Document Identifier to a FHIR Identifier.
 *
 * @param identifier CW Document Identifier.
 * @returns FHIR-compliant Identifier[]; otherwise undefined if a valid identifier cannot be determined.
 */
function convertCWIdentifierToFHIR(
  identifier: CWDocumentIdentifier[] | null | undefined
): Identifier[] | undefined {
  if (identifier) {
    return identifier.map(id => ({
      use: id.use !== "unspecified" ? id.use : undefined,
      system: id.system,
      value: id.value,
    }));
  }
}

/**
 * Get the authors from content that match the contained resources.
 *
 * @param content CW DocumentContent containing the doc ref's data coming from CW.
 * @param contained FHIR-compliant resources built from CW resources.
 * @returns FHIR References to be used as authors to the document reference.
 */
export function getAuthors(
  content: DocumentContent,
  contained: Resource[],
  docId: string
): Reference<AuthorTypes>[] {
  const refs = (content.author ?? []).flatMap(author => {
    if (
      author.reference &&
      typeof author.reference === "string" &&
      author.reference.startsWith("#")
    ) {
      return author.reference.substring(1);
    }
    if (author.reference) {
      // https://hl7.org/fhir/R4/references-definitions.html#Reference.reference
      capture.message(`Found an author reference that is not internal`, {
        extra: { author, docId, context: `toFHIR.getAuthors` },
        level: "warning",
      });
    }
    return author.reference ?? [];
  });

  const authorTypesAsStr = authorTypes.map(a => a.toString());
  const containedAuthors = contained
    .filter(c => authorTypesAsStr.includes(c.resourceType))
    .filter(r => r.id && refs.includes(r.id));

  const authors = containedAuthors.map(a => ({
    reference: `#${a.id}`,
    type: a.resourceType,
  }));
  return uniqBy(
    sortBy(authors, a => a.type),
    a => a.reference
  );
}

/**
 * Gets a CW HumanName attribute and returns it as a string[].
 * Works with prefix and suffix.
 *
 * @param attribute CW HumanName attribute.
 * @returns FHIR-compliant HumanName[].
 */
function getHumanNameAttribute(
  attribute: string | string[] | null | undefined
): string[] | undefined {
  let nameAttribute: string[] | undefined;
  if (attribute) {
    nameAttribute = typeof attribute === "string" ? splitName(attribute) : attribute;
  }
  return nameAttribute;
}

/**
 * Converts a CW Address to a FHIR Address.
 *
 * @param address CW Address.
 * @returns FHIR-compliant Address[]; otherwise undefined if a valid address cannot be determined.
 */
function convertCWAdressToFHIR(address: Contained["address"] | undefined): Address[] | undefined {
  if (address) {
    const fhirAddress: Address[] = address.map(a => {
      return {
        line: a.line ?? undefined,
        city: a.city ?? undefined,
        state: a.state ?? undefined,
        postalCode: a.zip ?? undefined,
        country: a.country ?? undefined,
        period: a.period ?? undefined,
        use:
          a.use == "home" ||
          a.use == "work" ||
          a.use == "temp" ||
          a.use == "old" ||
          a.use == "billing"
            ? a.use
            : undefined,
      };
    });

    return fhirAddress;
  }
}

/**
 * Converts a CW gender code to a FHIR gender type.
 *
 * @param genders CW gender code.
 * @returns FHIR-compliant gender string; otherwise undefined if a valid gender cannot be determined.
 */
function convertCWGenderToFHIR(genders: Gender[] | null | undefined): PatientFHIR["gender"] {
  if (genders && genders[0]) {
    switch (genders[0].code) {
      case GenderCodes.M:
        return "male";
      case GenderCodes.F:
        return "female";
      case GenderCodes.UN:
        return "other";
      case GenderCodes.UNK:
        return "unknown";
    }
  }
  return undefined;
}
