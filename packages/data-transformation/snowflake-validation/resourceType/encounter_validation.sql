select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    -- ID validation (first field in FHIR R4 spec)
    select 
        'encounter_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
) as t1
UNION ALL (
    select 
        'encounter_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_status' as metric_name,
        sum(
            case 
                when status not in ('planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown') or 
                     status is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-encounter-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_class' as metric_name,
        sum(
            case 
                when (class_code = '' or class_code is null) or
                     (class_system = '' or class_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.class
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_type' as metric_name,
        sum(
            case 
                when (type_0_coding_0_code = '' or type_0_coding_0_code is null) or
                     (type_0_coding_0_system = '' or type_0_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.type
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_priority' as metric_name,
        sum(
            case 
                when (priority_coding_0_code = '' or priority_coding_0_code is null) or
                     (priority_coding_0_system = '' or priority_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.priority
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_subject' as metric_name,
        sum(
            case 
                when subject_reference = '' or subject_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.subject
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_participant_individual' as metric_name,
        sum(
            case 
                when participant_0_individual_reference = '' or participant_0_individual_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.participant
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_period' as metric_name,
        sum(
            case 
                when (period_start = '' or period_start is null) and 
                     (period_end = '' or period_end is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.period
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_diagnosis_condition' as metric_name,
        sum(
            case 
                when diagnosis_0_condition_reference = '' or diagnosis_0_condition_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.diagnosis
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_hospitalization_dischargedisposition' as metric_name,
        sum(
            case 
                when (hospitalization_dischargedisposition_coding_0_code = '' or hospitalization_dischargedisposition_coding_0_code is null) or
                     (hospitalization_dischargedisposition_coding_0_system = '' or hospitalization_dischargedisposition_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.hospitalization
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_location_location' as metric_name,
        sum(
            case 
                when location_0_location_reference = '' or location_0_location_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.location
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)
UNION ALL (
    select 
        'encounter_service_provider' as metric_name,
        sum(
            case 
                when serviceprovider_reference = '' or serviceprovider_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/encounter-definitions.html#Encounter.serviceProvider
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from encounter 
)

/*
MISSING FHIR R4 ENCOUNTER FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/encounter.html

// - statusHistory: The status history associated with the encounter
// - classHistory: The history of statuses for this encounter
// - serviceType: The list of service performed during the encounter in the order they were performed
// - episodeOfCare: The episode of care that this encounter should be recorded against
// - basedOn: Details concerning a service requested
// - participant.type: The type of participant
// - participant.period: The period of time during the encounter that the participant participated
// - appointment: The appointment that scheduled this encounter
// - length: Length of the encounter
// - reasonCode: Reason the encounter takes place (currently only capturing references, not the full Condition resource details)
// - reasonReference: Reason the encounter takes place (currently only capturing references, not the full Condition resource details)
// - diagnosis.use: The use of the diagnosis (primary, secondary, etc.)
// - diagnosis.rank: The rank of the diagnosis (primary, secondary, etc.)
// - account: The set of accounts that may be used for billing for this encounter
// - hospitalization.preAdmissionIdentifier: The pre-admission identifier
// - hospitalization.origin: The origin of the patient
// - hospitalization.admitSource: The source of the hospitalization
// - hospitalization.reAdmission: Whether this is a re-admission
// - hospitalization.dietPreference: The diet preference
// - hospitalization.specialCourtesy: The special courtesy
// - hospitalization.specialArrangement: The special arrangement
// - hospitalization.destination: The destination of the patient
// - location.status: The status of the location
// - location.physicalType: The physical type of the location
// - location.period: The status history of the location
// - partOf: The larger event of which this particular event is a component or step
*/