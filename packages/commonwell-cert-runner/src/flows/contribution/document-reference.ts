import { nanoid } from "nanoid";

export function makeDocumentReference({
  orgId,
  orgName,
  patientId,
  docUrl,
  binaryId,
}: {
  orgId: string;
  orgName: string;
  patientId: string;
  docUrl: string;
  binaryId: string;
}) {
  const docRefId = nanoid();
  const data = `{
    "resourceType": "DocumentReference",
    "id": "${docRefId}",
    "meta": {
        "versionId": "19",
        "lastUpdated": "2023-02-24T16:07:16.796+00:00",
        "source": "${orgId.includes("urn:oid:") ? orgId : `urn:oid:${orgId}`}"
    },
    "contained": [
        {
            "resourceType": "Organization",
            "id": "${orgId}",
            "name": "${orgName}"
        },
        {
            "resourceType": "Patient",
            "id": "${patientId}"
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
                "display": "HIV 1 and 2 tests - Meaningful Use set"
            }
        ]
    },
    "subject": {
        "reference": "Patient/${patientId}",
        "type": "Patient"
    },
    "author": [
        {
            "reference": "#${orgId}",
            "type": "Organization"
        }
    ],
    "description": "Summarization Of Episode Notes - provided by Metriport",
    "content": [
        {
            "attachment": {
                "contentType": "application/xml",
                "url": "${docUrl}/Binary/${binaryId}"
            }
        }
    ],
    "context": {
        "event": [
            {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "62479008",
                        "display": "AIDS"
                    }
                ],
                "text": "AIDS"
            }
        ],
        "period": {
            "start": "2022-10-05T22:00:00.000Z",
            "end": "2022-10-05T23:00:00.000Z"
        },
        "sourcePatientInfo": {
            "reference": "#${patientId}",
            "type": "Patient"
        }
    }
  }`;
  return JSON.parse(data);
}
