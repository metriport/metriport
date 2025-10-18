with base_resource as (
    select
        id,
        subject_reference,
        status,
        period_start,
        period_end,
        class_system,
        class_code,
        class_display,
        meta_source
    from {{ref('stage__encounter')}}
),
target_type_codings as (
   {{   
        get_target_codings(
            get_encounter_type_codings,
            'encounter_id', 
            7, 
            1, 
            (
                'http://terminology.hl7.org/CodeSystem/encounter-type',
            )
        ) 
    }}
),
target_discharge_disposition_codings as (
    {{ 
        get_target_codings(
            get_encounter_discharge_disposition_codings, 
            'encounter_id', 
            1, 
            none, 
            (
                'http://terminology.hl7.org/CodeSystem/discharge-disposition',
            )
        ) 
    }}
)
select
        cast(enc.id as {{ dbt.type_string() }} )                                                as encounter_id      
    ,   cast(right(enc.subject_reference, 36) as {{ dbt.type_string() }} )                      as patient_id
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
                when enc.class_system ilike '%v3-ActCode%' then enc.class_code
                else null
            end as {{ dbt.type_string() }}
        )                                                                                       as act_code
    ,   cast(
            case 
                when enc.class_system ilike '%v3-ActCode%' then enc.class_display
                else null
            end as {{ dbt.type_string() }}
        )                                                                                       as act_display
    ,   cast(enc.class_code as {{ dbt.type_string() }} )                                        as source_class_code
    ,   cast(enc.class_display as {{ dbt.type_string() }} )                                     as source_class_display
    ,   cast(type_hl7.code as {{ dbt.type_string() }} )                                         as type_hl7_code
    ,   cast(type_hl7.display as {{ dbt.type_string() }} )                                      as type_hl7_display
    ,   cast(dd_hl7.code as {{ dbt.type_string() }} )                                           as discharge_disposition_hl7_code
    ,   cast(dd_hl7.display as {{ dbt.type_string() }} )                                        as discharge_disposition_hl7_display
    ,   cast(enc.meta_source as {{ dbt.type_string() }} )                                       as data_source
from base_resource as enc
left join target_type_codings type_hl7
    on enc.id = type_hl7.encounter_id 
        and type_hl7.system = 'http://terminology.hl7.org/CodeSystem/encounter-type'
left join target_discharge_disposition_codings dd_hl7
    on enc.id = dd_hl7.encounter_id 
        and dd_hl7.system = 'http://terminology.hl7.org/CodeSystem/discharge-disposition'
