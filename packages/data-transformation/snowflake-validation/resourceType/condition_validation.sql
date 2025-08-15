select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'condition_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from condition 
) as t1
UNION ALL (
    select 
        'condition_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/condition-definitions.html#Condition.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from condition 
)
UNION ALL (
    select 
        'condition_clinical_status' as metric_name,
        sum(
            case 
                when 
                    clinicalstatus_coding_0_code not in (
                        'active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'
                    )
                    or clinicalstatus_coding_0_system = '' 
                    or clinicalstatus_coding_0_system is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-condition-clinical.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from condition 
)
UNION ALL (
    select 
        'condition_category' as metric_name,
        sum(
            case 
                when (category_0_coding_0_code = '' or category_0_coding_0_code is null)
                     or (category_0_coding_0_system = '' or category_0_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/condition-definitions.html#Condition.category
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from condition 
)
UNION ALL (
    select 
        'condition_code' as metric_name,
        sum(
            case 
                when code_coding_0_code = '' or code_coding_0_code is null
                  or code_coding_0_system = '' or code_coding_0_system is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/condition-definitions.html#Condition.code
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from condition 
)
UNION ALL (
    select 
        'condition_subject' as metric_name,
        sum(
            case 
                when subject_reference = '' or subject_reference is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from condition 
)
UNION ALL (
    select 
        'condition_onset' as metric_name,
        sum(
            case 
                when (onsetperiod_start = '' or onsetperiod_start is null) and 
                     (onsetperiod_end = '' or onsetperiod_end is null)
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from condition 
)
UNION ALL (
    select 
        'condition_recorder' as metric_name,
        sum(
            case 
                when recorder_reference = '' or recorder_reference is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from condition 
)
UNION ALL (
    select 
        'condition_note' as metric_name,
        sum(
            case 
                when 
                    note_0_text = '' or note_0_text is null  or
                    note_0_time = '' or note_0_time is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/condition-definitions.html#Condition.note
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from condition 
)


/*
MISSING FHIR R4 CONDITION FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/condition.html'

// - verificationStatus: The verification status to support the clinical status of the allergy or intolerance 
//   (unconfirmed | confirmed | refuted | entered-in-error)
// - severity: A subjective assessment of the severity of the condition as evaluated by the clinician
// - bodySite: Anatomical location, if relevant
// - encounter: Encounter during which this condition was first asserted
// - abatement[x]: The date or estimated date that the condition resolved or went into remission (abatementDateTime, abatementAge, abatementPeriod, abatementRange, abatementString)
// - recordedDate: The recordedDate represents when this particular Condition record was created in the system
// - asserter: Individual who is making the condition statement
// - stage: The stage of the condition
// - evidence: Evidence supporting the diagnosis (currently only capturing references, not the full Evidence resource details)

*/