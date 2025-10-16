with code_rxnorm_coding as (
    {{   
        get_target_coding(
            get_medication_codings,
            'stage__medication', 
            'medication_id', 
            8, 
            none, 
            'http://www.nlm.nih.gov/research/umls/rxnorm'
        ) 
    }}
),
code_ndc_coding as (
    {{   
        get_target_coding(
            get_medication_codings,
            'stage__medication', 
            'medication_id', 
            8, 
            none, 
            'http://hl7.org/fhir/sid/ndc'
        ) 
    }}
)
select 
        cast(m.id as {{ dbt.type_string() }} )                                                              as medication_id
    ,   cast(tc_rxnorm.code as {{ dbt.type_string() }})                                                     as rxnorm_code
    ,   cast(tc_rxnorm.display as {{ dbt.type_string() }} )                                                 as rxnorm_display
    ,   cast(tc_ndc.code as {{ dbt.type_string() }} )                                                       as ndc_code
    ,   cast(tc_ndc.display as {{ dbt.type_string() }} )                                                    as ndc_display
    ,   cast(meta_source as {{ dbt.type_string() }} )                                                       as data_source
from {{ref('stage__medication')}} m
left join code_rxnorm_coding tc_rxnorm
    on m.id = tc_rxnorm.medication_id
left join code_ndc_coding tc_ndc
    on m.id = tc_ndc.medication_id
