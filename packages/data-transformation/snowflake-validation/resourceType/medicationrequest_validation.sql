select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'medicationrequest_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationrequest 
) as t1
UNION ALL (
    select  
        'medicationrequest_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationrequest-definitions.html#MedicationRequest.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationrequest 
)
UNION ALL (
    select 
        'medicationrequest_status' as metric_name,
        sum(
            case 
                when status not in ('active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown') or 
                     status is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-medicationrequest-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationrequest 
)
UNION ALL (
    select 
        'medicationrequest_intent' as metric_name,
        sum(
            case 
                when intent not in ('proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option') or 
                     intent is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-medicationrequest-intent.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationrequest 
)
UNION ALL (
    select 
        'medicationrequest_medication' as metric_name,
        sum(
            case 
                when medicationreference_reference = '' or medicationreference_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationrequest-definitions.html#MedicationRequest.medication[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationrequest 
)
UNION ALL (
    select 
        'medicationrequest_subject' as metric_name,
        sum(
            case 
                when subject_reference = '' or subject_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationrequest-definitions.html#MedicationRequest.subject
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationrequest 
)
UNION ALL (
    select 
        'medicationrequest_authored_on' as metric_name,
        sum(
            case 
                when authoredon = '' or authoredon is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationrequest-definitions.html#MedicationRequest.authoredOn
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationrequest 
)
UNION ALL (
    select 
        'medicationrequest_requester' as metric_name,
        sum(
            case 
                when requester_reference = '' or requester_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationrequest-definitions.html#MedicationRequest.requester
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationrequest 
)
UNION ALL (
    select 
        'medicationrequest_note' as metric_name,
        sum(
            case 
                when note_0_text = '' or note_0_text is null or
                     note_0_time = '' or note_0_time is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationrequest-definitions.html#MedicationRequest.reasonCode
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationrequest 
)


/*
MISSING FHIR R4 MEDICATIONREQUEST FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/medicationrequest.html

// - statusReason: The status reason of the medication request (currently only capturing references, not the full Reference resource details)
// - category: The category of the medication request
// - priority: The priority of the medication request
// - doNotPerform: The do not perform of the medication request
// - reported[x]: The reported of the medication request
// - medication.medicationCodeableConcept: The code of the medication
// - encounter: The encounter of the medication request (currently only capturing references, not the full Encounter resource details)
// - supportingInfo: The supporting information of the medication request (currently only capturing references, not the full Reference resource details)
// - performer: The performer of the medication request (currently only capturing references, not the full Practitioner resource details)
// - performerType: The performer type of the medication request
// - recorder: The recorder of the medication request (currently only capturing references, not the full Practitioner resource details)
// - reasonCode: The reason code of the medication request (currently only capturing references, not the full Condition resource details)
// - reasonReference: The reason reference of the medication request (currently only capturing references, not the full Condition resource details)
// - instantiatesCanonical: The instances canonical of the medication request
// - instantiatesUri: The instances uri of the medication request
// - basedOn: The based on of the medication request (currently only capturing references, not the full MedicationRequest resource details)
// - groupIdentifier: The group identifier of the medication request
// - courseOfTherapyType: The course of therapy type of the medication request
// - insurance: The treatment intent of the medication request
// - dosageInstruction: The dosage instruction of the medication request
// - dispenseRequest: The dispense request of the medication request (currently only capturing references, not the full MedicationDispense resource details)
// - substitution: The substitution of the medication request
// - priorPrescription: The prior prescription of the medication request (currently only capturing references, not the full MedicationRequest resource details)
// - detectedIssue: The detected issue of the medication request (currently only capturing references, not the full DetectedIssue resource details)
// - eventHistory: The event history of the medication request (currently only capturing references, not the full EventHistory resource details)
*/