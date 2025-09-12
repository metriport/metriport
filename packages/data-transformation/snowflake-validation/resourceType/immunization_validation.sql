select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'immunization_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
) as t1
UNION ALL (
    select 
        'immunization_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_status' as metric_name,
        sum(
            case 
                when status not in ('completed', 'entered-in-error', 'not-done') or 
                     status is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-immunization-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_status_reason' as metric_name,
        sum(
            case 
                when statusreason_text = '' or statusreason_text is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.statusReason
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_vaccine_code' as metric_name,
        sum(
            case 
                when (vaccinecode_text = '' or vaccinecode_text is null) and
                     ((vaccinecode_coding_0_code = '' or vaccinecode_coding_0_code is null) or
                      (vaccinecode_coding_0_system = '' or vaccinecode_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.vaccineCode
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_patient' as metric_name,
        sum(
            case 
                when patient_reference = '' or patient_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.patient
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_occurrence' as metric_name,
        sum(
            case 
                when (occurrencedatetime = '' or occurrencedatetime is null) and
                     (occurrencestring = '' or occurrencestring is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.occurrence[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_manufacturer' as metric_name,
        sum(
            case 
                when manufacturer_display = '' or manufacturer_display is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.manufacturer
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_lot_number' as metric_name,
        sum(
            case 
                when lotnumber = '' or lotnumber is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.lotNumber
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_site' as metric_name,
        sum(
            case 
                when (site_text = '' or site_text is null) and
                     ((site_coding_0_code = '' or site_coding_0_code is null) or
                      (site_coding_0_system = '' or site_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.site
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_route' as metric_name,
        sum(
            case 
                when (route_text = '' or route_text is null) and
                     ((route_coding_0_code = '' or route_coding_0_code is null) or
                      (route_coding_0_system = '' or route_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.route
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_dose_quantity' as metric_name,
        sum(
            case 
                when (dosequantity_value = '' or dosequantity_value is null) or
                     (dosequantity_unit = '' or dosequantity_unit is null) or
                     (dosequantity_system = '' or dosequantity_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.doseQuantity
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_performer' as metric_name,
        sum(
            case 
                when performer_0_actor_reference = '' or performer_0_actor_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.performer
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)
UNION ALL (
    select 
        'immunization_note' as metric_name,
        sum(
            case 
                when note_0_text = '' or note_0_text is null or
                     note_0_time = '' or note_0_time is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/immunization-definitions.html#Immunization.note
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from immunization 
)

/*
MISSING FHIR R4 IMMUNIZATION FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/immunization.html

// - encounter: The encounter associated with the immunization
// - recorded: The date and time the immunization was recorded
// - primarysource: The primary source of the information about the immunization
// - location: The location where the immunization occurred
// - expirationDate: The expiration date of the vaccine
// - performer.function: The function of the performer
// - reasonCode: The reason the immunization was administered (currently only capturing references, not the full Condition resource details)
// - reasonReference: The reason the immunization was administered (currently only capturing references, not the full Condition resource details)
// - isSubpotent: Whether the vaccine was stored sub-thermally
// - subpotentReason: The reason the vaccine was stored sub-thermally
// - education: The education associated with the immunization
// - programEligibility: The program eligibility associated with the immunization
// - fundingSource: The funding source associated with the immunization
// - reaction: The reaction to the immunization (currently only capturing references, not the full Reaction resource details)
// - protocolApplied: The protocol applied to the immunization
*/