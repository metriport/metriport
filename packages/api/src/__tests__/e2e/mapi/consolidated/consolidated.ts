import { AllergyIntolerance, Bundle } from "@medplum/fhirtypes";
import { makeDocumentReference } from "@metriport/core/external/fhir/document/__tests__/document-reference";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { PatientWithId } from "@metriport/core/external/fhir/__tests__/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import fs from "fs";
import { template } from "lodash";

dayjs.extend(utc);

export function createConsolidated(patient: PatientWithId): Bundle {
  const extension = [metriportDataSourceExtension];
  const entry: Bundle["entry"] = [
    {
      resource: { ...makeAllergyIntollerance({ patient }) },
    },
    {
      resource: { ...makeDocumentReference({ patient, extension }) },
    },
  ];
  return {
    resourceType: "Bundle",
    type: "collection",
    total: entry.length,
    entry,
  };
}

// TODO move to its own file, like `makeDocumentReference()`
export function makeAllergyIntollerance({
  patient,
}: {
  patient: PatientWithId;
}): AllergyIntolerance {
  return {
    resourceType: "AllergyIntolerance",
    id: uuidv7(),
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"],
    },
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: "active",
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
          code: "confirmed",
        },
      ],
    },
    type: "allergy",
    category: ["environment"],
    criticality: "low",
    reaction: [
      {
        manifestation: [
          {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "271807003",
                display: "Eruption of skin (disorder)",
              },
            ],
            text: "Eruption of skin (disorder)",
          },
        ],
        substance: {
          text: "Pollen",
        },
      },
    ],
    code: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "419199007",
          display: "Allergy to substance (finding)",
        },
      ],
      text: "Allergy to substance (finding)",
    },
    patient: {
      reference: `Patient/${patient.id}`,
    },
    recordedDate: "2010-09-03T03:10:10-05:00",
  };
}

export function checkConsolidatedHtml({
  html,
  patientId,
  outputExpectedFileName = "consolidated-expected",
  outputReceivedFileName = "consolidated-received",
}: {
  html: string;
  patientId: string;
  outputExpectedFileName?: string;
  outputReceivedFileName?: string;
}): boolean {
  const date = dayjs().utc().format("YYYY-MM-DD");

  const consolidatedHtmlFile = fs.readFileSync(`${__dirname}/consolidated-template.html`, "utf8");
  const compiled = template(consolidatedHtmlFile);
  const expectedContent = compiled({ date, patientId }).toString().trim();
  const receivedContent = html.trim();

  const isMatch = receivedContent === expectedContent;
  if (!isMatch) {
    fs.writeFileSync(`${__dirname}/${outputExpectedFileName}.html`, expectedContent);
    fs.writeFileSync(`${__dirname}/${outputReceivedFileName}.html`, receivedContent);
  }
  return isMatch;
}

// import { JSDOM } from "jsdom";
// import { Token } from "parse5";

// export type ValidationError = {
//   message: string;
//   selector: string;
//   items?: LocalItem[] | undefined;
// };

// export type LocalItem = {
//   value: string | undefined;
//   location: Token.Location | undefined;
//   localName: string;
// };

// function checkTitle(
//   document: HTMLBodyElement,
//   bundle: Bundle,
//   errors: ValidationError[],
//   convertToLocal: ReturnType<typeof buildConvertToLocal>
// ) {
//   const date = dayjs().format("YYYY-MM-DD");
//   const expectedTitle = `Medical Record Summar (${date})`;
//   const title = document.querySelectorAll("h1.title");
//   if (!title || title.length < 1) {
//     errors.push({ message: "Title not found", selector: "h1.title" });
//   } else {
//     const titleLocal = convertToLocal(title);
//     if (titleLocal.length > 1) {
//       errors.push({
//         message: "More than one title found",
//         selector: "h1.title",
//         items: titleLocal,
//       });
//     }

//     const singleTitle = titleLocal[0];
//     if (!singleTitle) throw new Error("Missing Title"); // programming error

//     const titleText = singleTitle.value;
//     if (!titleText) {
//       errors.push({ message: "Title missing content", selector: "h1.title" });
//     } else {
//       if (!titleText?.includes(expectedTitle)) {
//         errors.push({
//           message: "Invalid title",
//           selector: "h1.title",
//           items: [singleTitle],
//         });
//       }
//     }
//   }
// }

//  // auto generated code, interesting in case we could use non JSDOM-specific code
// function checkTitle2(
//   document: HTMLBodyElement,
//   bundle: Bundle,
//   errors: ValidationError[],
//   convertToLocal: ReturnType<typeof buildConvertToLocal>
// ) {
//   const title = document.querySelector("h1");
//   if (!title) {
//     errors.push({
//       message: "Title not found",
//       selector: "h1",
//       items: convertToLocal(document.querySelectorAll("h1")),
//     });
//     return;
//   }

//   if (title.textContent !== "Consolidated Medical Record") {
//     errors.push({
//       message: "Title is incorrect",
//       selector: "h1",
//       items: convertToLocal(document.querySelectorAll("h1")),
//     });
//   }
// }

// function buildConvertToLocal(dom: JSDOM) {
//   return (list: NodeListOf<Element>): LocalItem[] => {
//     const convertSingle = buildConvertSingleToLocal(dom);
//     const items: LocalItem[] = [];
//     for (const item of list) {
//       items.push(convertSingle(item));
//     }
//     return items;
//   };
// }

// function buildConvertSingleToLocal(dom: JSDOM) {
//   return (item: Element): LocalItem => {
//     return {
//       value: item.textContent ?? undefined,
//       location: dom.nodeLocation(item) ?? undefined,
//       localName: item.localName,
//     };
//   };
// }
