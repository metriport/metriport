with base_resource as (
    select
        id,
        status,
        meta_source
    from {{ref('stage__medication')}}
),
target_code_codings as (
    {{   
        get_target_codings(
            get_medication_codings,
            'medication_id', 
            8, 
            none, 
            (
                'http://www.nlm.nih.gov/research/umls/rxnorm',
                'http://hl7.org/fhir/sid/ndc'
            )
        ) 
    }}
)
select 
        cast(m.id as {{ dbt.type_string() }} )                                                              as medication_id
    ,   cast(m.status as {{ dbt.type_string() }} )                                                          as status
    ,   cast(tc_rxnorm.code as {{ dbt.type_string() }})                                                     as rxnorm_code
    ,   cast(tc_rxnorm.display as {{ dbt.type_string() }} )                                                 as rxnorm_display
    ,   cast(tc_ndc.code as {{ dbt.type_string() }} )                                                       as ndc_code
    ,   cast(tc_ndc.display as {{ dbt.type_string() }} )                                                    as ndc_display
    ,   cast(meta_source as {{ dbt.type_string() }} )                                                       as data_source
from base_resource m
left join target_code_codings tc_rxnorm
    on m.id = tc_rxnorm.medication_id 
        and tc_rxnorm.system = 'http://www.nlm.nih.gov/research/umls/rxnorm'
left join target_code_codings tc_ndc
    on m.id = tc_ndc.medication_id 
        and tc_ndc.system = 'http://hl7.org/fhir/sid/ndc'
