select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'observation_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
) as t1
UNION ALL (
    select 
        'observation_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    select 
        'observation_status' as metric_name,
        sum(
            case 
                when status not in ('registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown') or 
                     status is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-observation-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    select 
        'observation_category' as metric_name,
        sum(
            case 
                when (category_0_text = '' or category_0_text is null) and
                     ((category_0_coding_0_code = '' or category_0_coding_0_code is null) or
                      (category_0_coding_0_system = '' or category_0_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.category
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    select 
        'observation_code' as metric_name,
        sum(
            case 
                when (code_text = '' or code_text is null) and
                     ((code_coding_0_code = '' or code_coding_0_code is null) or
                      (code_coding_0_system = '' or code_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.code
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    select 
        'observation_subject' as metric_name,
        sum(
            case 
                when subject_reference = '' or subject_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.subject
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    -- Effective[x] validation (ninth field in FHIR R4 spec)
    select 
        'observation_effective' as metric_name,
        sum(
            case 
                when (effectivedatetime = '' or effectivedatetime is null) and
                     ((effectiveperiod_start = '' or effectiveperiod_start is null) and
                      (effectiveperiod_end = '' or effectiveperiod_end is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.effective[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    -- Performer validation (eleventh field in FHIR R4 spec)
    select 
        'observation_performer' as metric_name,
        sum(
            case 
                when performer_0_reference = '' or performer_0_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.performer
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    select 
        'observation_value' as metric_name,
        sum(
            case 
                when (valuequantity_value = '' or valuequantity_value is null) and
                     (valuestring = '' or valuestring is null) and
                     ((valuecodeableconcept_coding_0_code = '' or valuecodeableconcept_coding_0_code is null) or
                      (valuecodeableconcept_coding_0_system = '' or valuecodeableconcept_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.value[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    select 
        'observation_interpretation' as metric_name,
        sum(
            case 
                when (interpretation_0_coding_0_code = '' or interpretation_0_coding_0_code is null) or
                     (interpretation_0_coding_0_system = '' or interpretation_0_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.interpretation
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    select 
        'observation_note' as metric_name,
        sum(
            case 
                when note_0_text = '' or note_0_text is null or
                     note_0_time = '' or note_0_time is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.note
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    select 
        'observation_body_site' as metric_name,
        sum(
            case 
                when (bodysite_text = '' or bodysite_text is null) and
                     ((bodysite_coding_0_code = '' or bodysite_coding_0_code is null) or
                      (bodysite_coding_0_system = '' or bodysite_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.bodySite
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)
UNION ALL (
    -- Reference range validation (twentieth field in FHIR R4 spec)
    select 
        'observation_reference_range' as metric_name,
        sum(
            case 
                when (referencerange_0_low_value = '' or referencerange_0_low_value is null) and
                     (referencerange_0_high_value = '' or referencerange_0_high_value is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/observation-definitions.html#Observation.referenceRange
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from observation 
)

/*
MISSING FHIR R4 OBSERVATION FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/observation.html

// - basedOn: The based on of the observation (currently only capturing references, not the full Observation resource details)
// - partOf: The part of the observation (currently only capturing references, not the full Observation resource details)
// - focus: The focus of the observation (currently only capturing references, not the full Observation resource details)
// - encounter: The encounter of the observation (currently only capturing references, not the full Encounter resource details)
// - issued: The issued of the observation
// - dataAbsentReason: The data absent reason of the observation (currently only capturing references, not the full DataAbsentReason resource details)
// - method: The method of the observation (currently only capturing references, not the full CodeableConcept resource details)
// - specimen: The specimen of the observation (currently only capturing references, not the full Specimen resource details)
// - device: The device of the observation (currently only capturing references, not the full Device resource details)
// - hasMember: The has member of the observation (currently only capturing references, not the full Observation resource details)
// - derivedFrom: The derived from of the observation (currently only capturing references, not the full Observation resource details)
// - component: The component of the observation (currently only capturing references, not the full Observation resource details)
*/