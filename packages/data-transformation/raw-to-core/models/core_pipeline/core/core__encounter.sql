with type_hl7_coding as (
   {{   
        get_target_coding(
            get_encounter_type_codings,
            'stage__encounter', 
            'encounter_id', 
            7, 
            1, 
            'http://terminology.hl7.org/CodeSystem/encounter-type'
        ) 
    }}
),
discharge_disposition_hl7_coding as (
    {{ 
        get_target_coding(
            get_encounter_discharge_disposition_codings, 
            'stage__encounter', 
            'encounter_id', 
            1, 
            none, 
            'http://terminology.hl7.org/CodeSystem/discharge-disposition'
        ) }}
)
select
        cast(enc.id as {{ dbt.type_string() }} )                                                as encounter_id      
    ,   cast(p.id as {{ dbt.type_string() }} )                                                  as patient_id
    ,   cast(enc.status as {{ dbt.type_string() }} )                                            as status
    ,   {{ try_to_cast_date('enc.period_start', 'YYYY-MM-DD') }}                                as start_date
    ,   {{ try_to_cast_date('enc.period_end', 'YYYY-MM-DD') }}                                  as end_date
    ,   {{ 
            dbt.datediff(
                try_to_cast_date('enc.period_start', 'YYYY-MM-DD'),
                try_to_cast_date('enc.period_end', 'YYYY-MM-DD'),
                'day'
            )
        }}                                                                                      as length_of_stay
    ,   cast(
            case 
                when enc.class_system ilike '%ActEncounterCode%' then enc.class_code
                else null
            end as {{ dbt.type_string() }}
        )                                                                                       as act_code
    ,   cast(
            case 
                when enc.class_system ilike '%ActEncounterCode%' then enc.class_display
                else null
            end as {{ dbt.type_string() }}
        )                                                                                       as act_display
    ,   cast(type_hl7.code as {{ dbt.type_string() }} )                                         as type_hl7_code
    ,   cast(type_hl7.display as {{ dbt.type_string() }} )                                      as type_hl7_display
    ,   cast(dd_hl7.code as {{ dbt.type_string() }} )                                           as discharge_disposition_hl7_code
    ,   cast(dd_hl7.display as {{ dbt.type_string() }} )                                        as discharge_disposition_hl7_display
    ,   cast(right(enc.participant_0_individual_reference, 36) as {{ dbt.type_string() }} )     as participant_practitioner_id
    ,   cast(right(enc.location_0_location_reference, 36) as {{ dbt.type_string() }} )          as location_id
    ,   cast(right(enc.serviceprovider_reference, 36) as {{ dbt.type_string() }} )              as organization_id
    ,   cast(enc.meta_source as {{ dbt.type_string() }} )                                       as data_source
from {{ref('stage__encounter')}} as enc
left join {{ref('stage__patient') }} p
    on right(enc.subject_reference, 36) = p.id
left join type_hl7_coding type_hl7
    on enc.id = type_hl7.encounter_id
left join discharge_disposition_hl7_coding dd_hl7
    on enc.id = dd_hl7.encounter_id
