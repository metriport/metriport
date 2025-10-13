select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'medicationdispense_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
) as t1
UNION ALL (
    select 
        'medicationdispense_status' as metric_name,
        sum(
            case 
                when status not in ('preparation', 'in-progress', 'cancelled', 'on-hold', 'completed', 'entered-in-error', 'stopped', 'declined', 'unknown') or 
                     status is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-medicationdispense-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_status_reason' as metric_name,
        sum(
            case 
                when (statusreasoncodeableconcept_coding_0_code = '' or statusreasoncodeableconcept_coding_0_code is null) or
                     (statusreasoncodeableconcept_coding_0_system = '' or statusreasoncodeableconcept_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.statusReason[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_category' as metric_name,
        sum(
            case 
                when (category_coding_0_code = '' or category_coding_0_code is null) or
                     (category_coding_0_system = '' or category_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.category
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_medication' as metric_name,
        sum(
            case 
                when (medicationreference_reference = '' or medicationreference_reference is null) and
                     ((medicationcodeableconcept_coding_0_code = '' or medicationcodeableconcept_coding_0_code is null) or
                      (medicationcodeableconcept_coding_0_system = '' or medicationcodeableconcept_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.medication[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_subject' as metric_name,
        sum(
            case 
                when subject_reference = '' or subject_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.subject
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_context' as metric_name,
        sum(
            case 
                when context_reference = '' or context_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.context
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_supporting_information' as metric_name,
        sum(
            case 
                when supportinginformation_0_reference = '' or supportinginformation_0_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.supportingInformation
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_performer' as metric_name,
        sum(
            case 
                when performer_0_actor_reference = '' or performer_0_actor_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.performer
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_performer_function' as metric_name,
        sum(
            case 
                when (performer_0_function_coding_0_code = '' or performer_0_function_coding_0_code is null) or
                     (performer_0_function_coding_0_system = '' or performer_0_function_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.performer.function
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_location' as metric_name,
        sum(
            case 
                when location_reference = '' or location_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.location
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_authorizing_prescription' as metric_name,
        sum(
            case 
                when authorizingprescription_0_reference = '' or authorizingprescription_0_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.authorizingPrescription
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_type' as metric_name,
        sum(
            case 
                when (type_coding_0_code = '' or type_coding_0_code is null) or
                     (type_coding_0_system = '' or type_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.type
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_quantity' as metric_name,
        sum(
            case 
                when (quantity_value = '' or quantity_value is null) or
                     (quantity_unit = '' or quantity_unit is null) or
                     (quantity_system = '' or quantity_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.quantity
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_days_supply' as metric_name,
        sum(
            case 
                when (dayssupply_value = '' or dayssupply_value is null) or
                     (dayssupply_unit = '' or dayssupply_unit is null) or
                     (dayssupply_system = '' or dayssupply_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.daysSupply
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_when_prepared' as metric_name,
        sum(
            case 
                when whenprepared = '' or whenprepared is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.whenPrepared
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_when_handed_over' as metric_name,
        sum(
            case 
                when whenhandedover = '' or whenhandedover is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.whenHandedOver
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_destination' as metric_name,
        sum(
            case 
                when destination_reference = '' or destination_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.destination
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_receiver' as metric_name,
        sum(
            case 
                when receiver_0_reference = '' or receiver_0_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.receiver
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_note' as metric_name,
        sum(
            case 
                when note_0_text = '' or note_0_text is null or
                     note_0_time = '' or note_0_time is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.note
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_dosage_instruction_route' as metric_name,
        sum(
            case 
                when (dosageinstruction_0_route_coding_0_code = '' or dosageinstruction_0_route_coding_0_code is null) or
                     (dosageinstruction_0_route_coding_0_system = '' or dosageinstruction_0_route_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.dosageInstruction.route
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_substitution' as metric_name,
        sum(
            case 
                when substitution_wassubstituted = '' or substitution_wassubstituted is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.substitution
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_substitution_type' as metric_name,
        sum(
            case 
                when (substitution_type_coding_0_code = '' or substitution_type_coding_0_code is null) or
                     (substitution_type_coding_0_system = '' or substitution_type_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.substitution.type
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)
UNION ALL (
    select 
        'medicationdispense_substitution_reason' as metric_name,
        sum(
            case 
                when (substitution_reason_0_coding_0_code = '' or substitution_reason_0_coding_0_code is null) or
                     (substitution_reason_0_coding_0_system = '' or substitution_reason_0_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/medicationdispense-definitions.html#MedicationDispense.substitution.reason
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from medicationdispense 
)

/*
MISSING FHIR R4 MEDICATIONDISPENSE FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/medicationdispense.html

// - partOf: The form of the medication
// - statusReason.statusReasonReference: The status reason of the medication administration (currently only capturing references, not the full Reference resource details)
// - dosageInstruction.text: The text of the dosage instruction
// - dosageInstruction.dose: The dose of the dosage instruction
// - dosageInstruction.rate: The rate of the dosage instruction
// - dosageInstruction.site: The site of the dosage instruction
// - dosageInstruction.method: The method of the dosage instruction
// - dosageInstruction.rate: The rate of the dosage instruction
*/ 