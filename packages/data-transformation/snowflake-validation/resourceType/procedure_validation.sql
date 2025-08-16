select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'procedure_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from procedure 
) as t1
UNION ALL (
    select 
        'procedure_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/procedure-definitions.html#Procedure.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from procedure 
)
UNION ALL (
    select 
        'procedure_status' as metric_name,
        sum(
            case 
                when status not in ('preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown') or 
                     status is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-procedure-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from procedure 
)
UNION ALL (
    select 
        'procedure_code' as metric_name,
        sum(
            case 
                when (code_text = '' or code_text is null) and
                     ((code_coding_0_code = '' or code_coding_0_code is null) or
                      (code_coding_0_system = '' or code_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/procedure-definitions.html#Procedure.code
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from procedure 
)
UNION ALL (
    select 
        'procedure_subject' as metric_name,
        sum(
            case 
                when subject_reference = '' or subject_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/procedure-definitions.html#Procedure.subject
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from procedure 
)
UNION ALL (
    select 
        'procedure_performed' as metric_name,
        sum(
            case 
                when (performeddatetime = '' or performeddatetime is null) and
                     ((performedperiod_start = '' or performedperiod_start is null) and
                      (performedperiod_end = '' or performedperiod_end is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/procedure-definitions.html#Procedure.performed[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from procedure 
)
UNION ALL (
    select 
        'procedure_performer' as metric_name,
        sum(
            case 
                when performer_0_actor_reference = '' or performer_0_actor_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/procedure-definitions.html#Procedure.performer
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from procedure 
)
UNION ALL (
    select 
        'procedure_reason_code' as metric_name,
        sum(
            case 
                when (reasoncode_0_coding_0_code = '' or reasoncode_0_coding_0_code is null) or
                     (reasoncode_0_coding_0_system = '' or reasoncode_0_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/procedure-definitions.html#Procedure.reasonCode
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from procedure 
)
UNION ALL (
    select 
        'procedure_note' as metric_name,
        sum(
            case 
                when note_0_text = '' or note_0_text is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/procedure-definitions.html#Procedure.note
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from procedure 
)

/*
MISSING FHIR R4 PROCEDURE FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/procedure.html

// - instantiatesCanonical: The instances canonical of the procedure
// - instantiatesUri: The instances uri of the procedure
// - basedOn: The based on of the procedure (currently only capturing references, not the full Procedure resource details)
// - partOf: The part of the procedure (currently only capturing references, not the full Procedure resource details)
// - statusReason: The status reason of the procedure (currently only capturing references, not the full Reference resource details)
// - category: The category of the procedure
// - encounter: The encounter of the procedure (currently only capturing references, not the full Encounter resource details)
// - recorder: The recorder of the procedure (currently only capturing references, not the full Practitioner resource details)
// - asserter: The asserter of the procedure (currently only capturing references, not the full Practitioner resource details)
// - performer.function: The function of the performer
// - performer.onBehalfOf: The on behalf of of the performer (currently only capturing references, not the full Organization resource details)
// - location: The location of the procedure (currently only capturing references, not the full Location resource details)
// - reasonReference: The reason reference of the procedure (currently only capturing references, not the full Condition resource details)
// - bodySite: The body site of the procedure (currently only capturing references, not the full BodySite resource details)
// - outcome: The outcome of the procedure
// - report: The report of the procedure (currently only capturing references, not the full Reference resource details)
// - complication: The complication of the procedure
// - complicationDetail: The complication detail of the procedure
// - followUp: The follow up of the procedure
// - usedReference: The used reference of the procedure (currently only capturing references, not the full Reference resource details)
// - usedCode: The used code of the procedure (currently only capturing references, not the full CodeableConcept resource details)
*/