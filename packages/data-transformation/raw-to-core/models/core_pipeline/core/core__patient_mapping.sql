{{ config(unique_key='m_patient_id') }}

select
        {{ try_to_cast_string('pat.id') }} as id
    ,   case
            when pat.identifier_0_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
                then {{ try_to_cast_string('pat.identifier_0_value') }}
            when pat.identifier_1_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
                then {{ try_to_cast_string('pat.identifier_1_value') }}
            when pat.identifier_2_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
                then {{ try_to_cast_string('pat.identifier_2_value') }}
            when pat.identifier_3_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
                then {{ try_to_cast_string('pat.identifier_3_value') }}
            when pat.identifier_4_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
                then {{ try_to_cast_string('pat.identifier_4_value') }}
            else null
        end as external_id
    ,   pat.m_patient_id
    ,   pat.m_job_id
    ,   pat.m_created_at
    ,   pat.m_updated_at
    ,   pat.m_deleted_at
    ,   pat.raw_to_core_job_id
from {{ ref('stage__patient') }} pat
where
    pat.identifier_0_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
    or pat.identifier_1_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
    or pat.identifier_2_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
    or pat.identifier_3_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
    or pat.identifier_4_system = 'https://public.metriport.com/fhir/StructureDefinition/external-id.json'
