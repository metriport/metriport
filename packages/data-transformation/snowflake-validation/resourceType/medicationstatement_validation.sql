select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'medicationstatement_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationstatement 
) as t1
UNION ALL (
    select  
        'medicationstatement_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationstatement-definitions.html#MedicationStatement.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationstatement 
)
UNION ALL (
    select 
        'medicationstatement_status' as metric_name,
        sum(
            case 
                when status not in ('active', 'inactive', 'entered-in-error') or 
                     status is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-medication-statement-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationstatement 
)
UNION ALL (
    select 
        'medicationstatement_medication' as metric_name,
        sum(
            case 
                when medicationreference_reference = '' or medicationreference_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationstatement-definitions.html#MedicationStatement.medication[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationstatement 
)
UNION ALL (
    select 
        'medicationstatement_subject' as metric_name,
        sum(
            case 
                when subject_reference = '' or subject_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationstatement-definitions.html#MedicationStatement.subject
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationstatement 
)
UNION ALL (
    select 
        'medicationstatement_effective' as metric_name,
        sum(
            case 
                when (effectiveperiod_start = '' or effectiveperiod_start is null) and 
                     (effectiveperiod_end = '' or effectiveperiod_end is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationstatement-definitions.html#MedicationStatement.effectivePeriod
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationstatement 
)
UNION ALL (
    select 
        'medicationstatement_note' as metric_name,
        sum(
            case 
                when note_0_text = '' or note_0_text is null or
                     note_0_time = '' or note_0_time is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationstatement-definitions.html#MedicationStatement.note
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationstatement 
)
UNION ALL (
    select 
        'medicationstatement_dosage_route' as metric_name,
        sum(
            case 
                when (dosage_0_route_text = '' or dosage_0_route_text is null) and
                     ((dosage_0_route_coding_0_code = '' or dosage_0_route_coding_0_code is null) or
                      (dosage_0_route_coding_0_system = '' or dosage_0_route_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationstatement-definitions.html#MedicationStatement.dosage.route
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationstatement 
)
UNION ALL (
    select 
        'medicationstatement_dosage_doseandrate_dosequantity' as metric_name,
        sum(
            case 
                when (dosage_0_doseandrate_0_dosequantity_value = '' or dosage_0_doseandrate_0_dosequantity_value is null) or
                     (dosage_0_doseandrate_0_dosequantity_unit = '' or dosage_0_doseandrate_0_dosequantity_unit is null) or
                     (dosage_0_doseandrate_0_dosequantity_system = '' or dosage_0_doseandrate_0_dosequantity_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationstatement-definitions.html#MedicationStatement.dosage.doseAndRate
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationstatement 
)

/*
MISSING FHIR R4 MEDICATIONSTATEMENT FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/medicationstatement.html

// - basedOn: The based on of the medication statement (currently only capturing references, not the full MedicationRequest resource details)
// - partOf: The part of the medication statement (currently only capturing references, not the full MedicationStatement resource details)
// - statusReason: The status reason of the medication statement (currently only capturing references, not the full Reference resource details)
// - category: The category of the medication statement
// - medication.medicationCodeableConcept: The code of the medication
// - context: The context of the medication statement (currently only capturing references, not the full Encounter resource details)
// - dateAsserted: The date asserted of the medication statement
// - informationSource: The information source of the medication statement (currently only capturing references, not the full Practitioner resource details)
// - derivedFrom: The derived from of the medication statement (currently only capturing references, not the full MedicationStatement resource details)
// - reasonCode: The reason code of the medication statement (currently only capturing references, not the full Condition resource details)
// - reasonReference: The reason reference of the medication statement (currently only capturing references, not the full Condition resource details)
// - dosage.sequence: The sequence of the dosage
// - dosage.text: The text of the dosage
// - dosage.additionalInstruction: The additional instruction of the dosage
// - dosage.patientInstruction: The patient instruction of the dosage
// - dosage.timing: The timing of the dosage
// - dosage.asNeeded: The as needed of the dosage
// - dosage.site: The as needed timing of the dosage
// - dosage.method: The as needed dosage of the dosage
// - dosage.dosageAndRate.type: The type of the dosage
// - dosage.dosageAndRate.dose.dosageRange: The dosage range of the dosage
// - dosage.dosageAndRate.rate;
// - dosage.maxDosePerPeriod: The max dose per period of the dosage
// - dosage.maxDosePerAdministration: The max dose per administration of the dosage (currently only capturing references, not the full Quantity resource details)
// - dosage.maxDosePerLifetime: The max dose per lifetime of the dosage
*/ 