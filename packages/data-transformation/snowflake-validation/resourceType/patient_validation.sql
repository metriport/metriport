select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    -- ID validation (first field in FHIR R4 spec)
    select 
        'patient_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from patient 
) as t1
UNION ALL (
    select 
        'patient_identifier' as metric_name,
        sum(
            case 
                when name_0_family = '' or name_0_family is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/patient-definitions.html#Patient.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from patient 
)
UNION ALL (
    select 
        'patient_name' as metric_name,
        sum(
            case 
                when name_0_given_0 = '' or name_0_given_0 is null or
                     name_0_family = '' or name_0_family is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/patient-definitions.html#Patient.active
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from patient 
)
UNION ALL (
    select 
        'patient_telecom' as metric_name,
        sum(
            case 
                when (telecom_0_system = '' or telecom_0_system is null) or
                     (telecom_0_value = '' or telecom_0_value is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/patient-definitions.html#Patient.telecom
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from patient 
)
UNION ALL (
    select 
        'patient_gender' as metric_name,
        sum(
            case 
                when gender not in ('male', 'female', 'other', 'unknown') or gender is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-administrative-gender.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from patient 
)
UNION ALL (
    select 
        'patient_birth_date' as metric_name,
        sum(
            case 
                when birthdate = '' or birthdate is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/patient-definitions.html#Patient.birthDate
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from patient 
)
UNION ALL (
    -- Address validation (ninth field in FHIR R4 spec)
    select 
        'patient_address' as metric_name,
        sum(
            case 
                when (address_0_line_0 = '' or address_0_line_0 is null) and
                     (address_0_city = '' or address_0_city is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/patient-definitions.html#Patient.address
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from patient 
)

/*
MISSING FHIR R4 PATIENT FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/patient.html

// - deceased[x]: The deceased of the patient
// - multipleBirthBoolean: The multiple birth boolean of the patient
// - multipleBirthInteger: The multiple birth integer of the patient
// - photo: The photo of the patient
// - contact: The contact of the patient
// - communication: The communication of the patient
// - generalPractitioner: The general practitioner of the patient (currently only capturing references, not the full Practitioner resource details)
// - managingOrganization: The managing organization of the patient (currently only capturing references, not the full Organization resource details)
// - link: The link of the patient (currently only capturing references, not the full Patient resource details)
*/