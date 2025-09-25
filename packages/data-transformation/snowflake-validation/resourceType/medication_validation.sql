select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'medication_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medication 
) as t1
UNION ALL (
    select 
        'medication_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medication-definitions.html#Medication.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medication 
)
UNION ALL (
    select 
        'medication_code' as metric_name,
        sum(
            case 
                when (code_text = '' or code_text is null) and
                     ((code_coding_0_code = '' or code_coding_0_code is null) or
                      (code_coding_0_system = '' or code_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medication-definitions.html#Medication.code
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medication 
)
UNION ALL (
    select 
        'medication_status' as metric_name,
        sum(
            case 
                when status not in ('active', 'inactive', 'entered-in-error') or 
                     status is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-medication-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medication 
)

/*
MISSING FHIR R4 MEDICATION FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/medication.html

// - manufacturer: The manufacturer of the medication
// - form: The form of the medication
// - amount: The amount of the medication
// - ingredient: The ingredient of the medication
// - batch: The batch of the medication
*/ 