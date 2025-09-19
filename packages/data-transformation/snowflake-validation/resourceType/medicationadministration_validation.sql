select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'medicationadministration_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
) as t1
UNION ALL (
    select 
        'medicationadministration_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationadministration-definitions.html#MedicationAdministration.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)
UNION ALL (
    select 
        'medicationadministration_status' as metric_name,
        sum(
            case 
                when status not in ('in-progress', 'not-done', 'on-hold', 'completed', 'entered-in-error', 'stopped', 'unknown') or 
                     status is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-medication-admin-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)
UNION ALL (
    select 
        'medicationadministration_medication' as metric_name,
        sum(
            case 
                when medicationreference_reference = '' or medicationreference_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationadministration-definitions.html#MedicationAdministration.medication[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)
UNION ALL (
    select 
        'medicationadministration_subject' as metric_name,
        sum(
            case 
                when subject_reference = '' or subject_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationadministration-definitions.html#MedicationAdministration.subject
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)
UNION ALL (
    select 
        'medicationadministration_context' as metric_name,
        sum(
            case 
                when context_reference = '' or context_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationadministration-definitions.html#MedicationAdministration.context
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)
UNION ALL (
    select 
        'medicationadministration_effective' as metric_name,
        sum(
            case 
                when (effectiveperiod_start = '' or effectiveperiod_start is null) and 
                     (effectiveperiod_end = '' or effectiveperiod_end is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationadministration-definitions.html#MedicationAdministration.effectivePeriod
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)
UNION ALL (
    select 
        'medicationadministration_reason_reference' as metric_name,
        sum(
            case 
                when reasonreference_0_reference = '' or reasonreference_0_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationadministration-definitions.html#MedicationAdministration.reasonReference
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)
UNION ALL (
    select 
        'medicationadministration_note' as metric_name,
        sum(
            case 
                when note_0_text = '' or note_0_text is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationadministration-definitions.html#MedicationAdministration.note
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)
UNION ALL (
    select 
        'medicationadministration_dosage_route' as metric_name,
        sum(
            case 
                when (dosage_route_text = '' or dosage_route_text is null) and
                     ((dosage_route_coding_0_code = '' or dosage_route_coding_0_code is null) or
                      (dosage_route_coding_0_system = '' or dosage_route_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationadministration-definitions.html#MedicationAdministration.dosage.route
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)
UNION ALL (
    select 
        'medicationadministration_dosage_dose' as metric_name,
        sum(
            case 
                when (dosage_dose_value = '' or dosage_dose_value is null) or
                     (dosage_dose_unit = '' or dosage_dose_unit is null) or
                     (dosage_dose_system = '' or dosage_dose_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationadministration-definitions.html#MedicationAdministration.dosage.dose
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationadministration 
)

/*
MISSING FHIR R4 MEDICATIONADMINISTRATION FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/medicationadministration.html

// - instantiates: The instantiates of the medication administration
// - partOf: The form of the medication
// - statusReason: The status reason of the medication administration
// - category: The category of the medication administration
// - medication.medicationCodeableConcept: The code of the medication
// - supportingInformation: The supporting information of the medication administration (currently only capturing references, not the full Reference resource details)
// - performer: The performer of the medication administration (currently only capturing references, not the full Practitioner resource details)
// - reasonCode: The reason the me  dication administration was administered (currently only capturing references, not the full Condition resource details)
// - reasonReference: The reason the medication administration was administered (currently only capturing references, not the full Condition resource details)
// - request: The request of the medication administration (currently only capturing references, not the full MedicationRequest resource details)
// - device: The device of the medication administration (currently only capturing references, not the full Device resource details)
// - dosage.text: The text of the dosage
// - dosage.site: The site of the dosage
// - dosage.method: The method of the dosage
// - dosage.rate: The rate of the dosage
*/ 