import json

from canvas_workflow_kit.constants import CHANGE_TYPE
from canvas_workflow_kit.protocol import (STATUS_NOT_APPLICABLE,
                                          ClinicalQualityMeasure,
                                          ProtocolResult)
from canvas_workflow_kit.utils import send_notification
from canvas_workflow_kit.fhir import FumageHelper


class AppointmentNotification2(ClinicalQualityMeasure):
    class Meta:
        title = 'Appointment Creation Notification'
        version = 'v1.2.8'
        description = 'Listens for appointment creation and sends a notification.'
        types = ['Notification']
        compute_on_change_types = [CHANGE_TYPE.APPOINTMENT]
        notification_only = True

    def compute_results(self):
        result = ProtocolResult()
        result.status = STATUS_NOT_APPLICABLE
        ## manually change this before uploading protocol to production account to sandbox URL
        base_url = 'https://api.staging.metriport.com'
        changed_model = self.field_changes.get('model_name', '')

        if changed_model == 'appointment' and self.field_changes.get('created'):
            fhir = FumageHelper(self.settings)

            response = fhir.read("Appointment", self.field_changes.get('external_id'))
            if response.status_code != 200:
                raise Exception("Failed to search Appointments")

            patient_data = self.patient.patient

            payload = {
                "firstName": patient_data.get("firstName"),
                "lastName": patient_data.get("lastName"),
                "dob": patient_data.get("birthDate"),
                "genderAtBirth": patient_data.get("sexAtBirth"),
                "address": [
                    {
                        "addressLine1": patient_data["addresses"][0]["line"][0] if patient_data.get("addresses") else "",
                        "addressLine2": patient_data["addresses"][0]["line"][1] if patient_data.get("addresses") and len(patient_data["addresses"][0]["line"]) > 1 else "",
                        "city": patient_data["addresses"][0].get("city", "") if patient_data.get("addresses") else "",
                        "state": patient_data["addresses"][0].get("stateCode", "") if patient_data.get("addresses") else "",
                        "zip": patient_data["addresses"][0].get("postalCode", "") if patient_data.get("addresses") else "",
                    }
                ],
                "contact": [
                    {
                        key: value for key, value in {
                            "phone": next((telecom["value"] for telecom in patient_data.get("telecom", []) if telecom["system"] == "phone"), None),
                            "email": next((telecom["value"] for telecom in patient_data.get("telecom", []) if telecom["system"] == "email"), None)
                        }.items() if value is not None
                    }
                ],
                "externalId": patient_data.get("key")
            }

            metriport_api_key = self.settings.get("METRIPORT_API_KEY")
            metriport_facility_id = self.settings.get("METRIPORT_FACILITY_ID")
            provider_name = self.settings.get("CANVAS_PROVIDER_NAME")


            pd_response = send_notification(
                f'{base_url}/medical/v1/patient?facilityId={metriport_facility_id}',
                json.dumps(payload),
                headers={
                    'Content-Type': 'application/json',
                    'x-api-key': metriport_api_key
                })
        
            pd_response_data = pd_response.json()
            patient_id = pd_response_data.get('id')
            result.add_narrative(json.dumps({
                'patient': pd_response_data
            }))

            if patient_id:
                metadata = {
                    'metadata': {
                        'canvas': "true",
                        'providerLastName': provider_name
                    }
                };
            
                dq_response = send_notification(
                    f'{base_url}/medical/v1/document/query?patientId={patient_id}',
                    json.dumps(metadata),
                    headers={
                        'Content-Type': 'application/json',
                        'x-api-key': metriport_api_key
                    }
                )
            else:
                result.add_narrative("Unable to retrieve patient ID from the response")

        return result