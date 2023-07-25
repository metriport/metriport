import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import { makeFhirApi } from "../../external/fhir/api/api-factory";
import { getOrganizationOrFail } from "./organization/get-organization";
import { getPatientOrFail } from "./patient/get-patient";
import { Config } from "../../shared/config";

const docContributionUrl = Config.getDocContributionUrl();

export async function createAndUploadDocReference({
  cxId,
  patientId,
  file,
  metadata,
}: {
  cxId: string;
  patientId: string;
  file: Express.Multer.File;
  metadata: {
    description: string;
  };
}): Promise<void> {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  const organization = await getOrganizationOrFail({ cxId });

  const fhirApi = makeFhirApi(cxId);
  const docRefId = uuidv4();

  const now = dayjs();

  const data = `{
        "resourceType": "DocumentReference",
        "id": "${docRefId}",
        "contained": [
            {
                "resourceType": "Organization",
                "id": "${organization.id}",
                "name": "${organization.data.name}"
            },
            {
                "resourceType": "Patient",
                "id": "${patient.id}"
            }
        ],
        "masterIdentifier": {
            "system": "urn:ietf:rfc:3986",
            "value": "${docRefId}"
        },
        "identifier": [
            {
                "use": "official",
                "system": "urn:ietf:rfc:3986",
                "value": "${docRefId}"
            }
        ],
        "status": "current",
        "type": {
          "coding": [
              {
                  "system": "http://loinc.org/",
                  "code": "75622-1",
                  "display":  "${metadata.description}"
              }
          ]
        },
        "subject": {
            "reference": "Patient/${patient.id}",
            "type": "Patient"
        },
        "author": [
            {
                "reference": "#${organization.id}",
                "type": "Organization"
            }
        ],
        "description": "${metadata.description}",
        "content": [
            {
                "attachment": {
                    "contentType": "${file.mimetype}",
                    "url": "${docContributionUrl}?fileName=${file.originalname}"
                }
            }
        ],
        "context": {
          "period": {
              "start": "${now.format()}",
              "end": "${now.add(1, "hour").format()}"
          },
          "sourcePatientInfo": {
              "reference": "#${patient.id}",
              "type": "Patient"
          }
      }
    }`;

  await fhirApi.updateResource(JSON.parse(data));
}
