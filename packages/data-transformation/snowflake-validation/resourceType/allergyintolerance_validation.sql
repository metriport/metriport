select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'allergyintolerance_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
) as t1
UNION ALL (
    select 
        'allergyintolerance_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/allergyintolerance-definitions.html#AllergyIntolerance.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)
UNION ALL (
    select 
        'allergyintolerance_clinical_status' as metric_name,
        sum(
            case 
                when 
                    clinicalstatus_coding_0_code not in (
                        'active', 'inactive', 'resolved'
                    )
                    or clinicalstatus_coding_0_system = '' 
                    or clinicalstatus_coding_0_system is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-allergyintolerance-clinical.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)
UNION ALL (
    select 
        'allergyintolerance_patient' as metric_name,
        sum(
            case 
                when 
                    patient_reference = '' or patient_reference is null  
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-allergyintolerance-clinical.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)
UNION ALL (
    select 
        'allergyintolerance_onset' as metric_name,
        sum(
            case 
                when onsetdatetime = '' or onsetdatetime = null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/allergyintolerance-definitions.html#AllergyIntolerance.onset_x_
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)
UNION ALL (
    select 
        'allergyintolerance_recorder' as metric_name,
        sum(
            case 
                when 
                    recorder_reference = '' or recorder_reference is null  
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-allergyintolerance-clinical.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)
UNION ALL (
    select 
        'allergyintolerance_note' as metric_name,
        sum(
            case 
                when 
                    note_0_text = '' or note_0_text is null  or
                    note_0_time = '' or note_0_time is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-allergyintolerance-clinical.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)
UNION ALL (
    select 
        'allergyintolerance_reaction_substance' as metric_name,
        sum(
            case 
                when 
                    (reaction_0_substance_text = '' or reaction_0_substance_text is null) and
                    ((reaction_0_substance_coding_0_code = '' or reaction_0_substance_coding_0_code is null) or
                     (reaction_0_substance_coding_0_system = '' or reaction_0_substance_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/allergyintolerance-definitions.html#AllergyIntolerance.reaction.substance
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)
UNION ALL (
    select 
        'allergyintolerance_reaction_manifestation' as metric_name,
        sum(
            case 
                when 
                    (reaction_0_manifestation_0_text = '' or reaction_0_manifestation_0_text is null) and
                    ((reaction_0_manifestation_0_coding_0_code = '' or reaction_0_manifestation_0_coding_0_code is null) or
                     (reaction_0_manifestation_0_coding_0_system = '' or reaction_0_manifestation_0_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/allergyintolerance-definitions.html#AllergyIntolerance.reaction.manifestation
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)
UNION ALL (
    select 
        'allergyintolerance_reaction_onset' as metric_name,
        sum(
            case 
                when reaction_0_onset = '' or reaction_0_onset is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/allergyintolerance-definitions.html#AllergyIntolerance.reaction.onset
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)
UNION ALL (
    select 
        'allergyintolerance_reaction_severity' as metric_name,
        sum(
            case 
                when 
                    -- NOTE: reaction.severity is not currently captured in the flattened schema
                    -- This validation will always show 100% invalid until severity is added
                    -- Expected FHIR R4 values: 'mild', 'moderate', 'severe'
                    -- https://hl7.org/fhir/R4/valueset-reaction-event-severity.html
                    1 = 1  -- Always true, indicating missing severity data
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-reaction-event-severity.html - NOT IMPLEMENTED IN SCHEMA
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from allergyintolerance 
)

/*
MISSING FHIR R4 ALLERGYINTOLERANCE FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/allergyintolerance.html

// - verificationStatus: The verification status to support the clinical status of the allergy or intolerance 
//   (unconfirmed | confirmed | refuted | entered-in-error)
// - type: Identification of the underlying physiological mechanism (allergy | intolerance)
// - category: Category of the identified substance (food | medication | environment | biologic)
// - criticality: Estimate of the potential clinical harm if the patient is re-exposed to the substance 
//   (low | high | unable-to-assess)
// - code: Code that identifies the specific substance or allergen (distinct from reaction.substance)
// - encounter: The encounter when the allergy or intolerance was asserted
// - recordedDate: The date when the allergy or intolerance was first recorded
// - asserter: The source who asserted the allergy or intolerance (Patient, Practitioner, PractitionerRole, RelatedPerson)
// - lastOccurrence: The most recent date/time when a reaction to the identified substance occurred
// - reaction.description: Text description about the reaction event
// - reaction.exposureRoute: The route by which the subject was exposed to the substance
// - reaction.note: Additional text or comments about the reaction

*/