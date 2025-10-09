with medication_statements_with_codings as (
    select 
            *
        ,   medstmt.id                                                                              as medication_statement_id
        ,   medstmt.meta_source                                                                     as medication_statement_meta_source
        ,   medstmt.status                                                                          as medication_statement_status
            -- RxNorm code and display
        ,   {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'code', 8) }}        as rxnorm_code
        ,   {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'system', 8) }}      as rxnorm_system
        ,   {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'display', 8) }}     as rxnorm_display

            -- NDC code and display
        ,   {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'code', 8) }}                        as ndc_code
        ,   {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'system', 8) }}                      as ndc_system
        ,   {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'display', 8) }}                     as ndc_display

            -- ATC code and display
        ,   {{ get_coding_value('http://www.whocc.no/atc', 'code', 8) }}                            as atc_code
        ,   {{ get_coding_value('http://www.whocc.no/atc', 'system', 8) }}                          as atc_system
        ,   {{ get_coding_value('http://www.whocc.no/atc', 'display', 8) }}                         as atc_display
  from {{ref('stage__medicationstatement')}} medstmt
  inner join {{ref('stage__medication') }} med
    on right(medstmt.medicationreference_reference, 36) = med.id
)
select
        cast(m.medication_statement_id as {{ dbt.type_string() }} )                                 as medication_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                      as patient_id
    ,   cast(null as {{ dbt.type_string() }} )                                                      as encounter_id
    ,   {{ try_to_cast_date('null') }}                                                              as dispensing_date
    ,   {{ try_to_cast_date('effectiveperiod_start') }}                                             as prescribing_date
    ,   cast(
            case 
                when m.rxnorm_system is not null then 'rxnorm'
                when m.ndc_system is not null then 'ndc'
                when m.atc_system is not null then 'atc'
                else null
            end as {{ dbt.type_string() }}
        )                                                                                           as source_code_type
    ,   cast(
            case
                when m.rxnorm_system is not null then m.rxnorm_code
                when m.ndc_system is not null then m.ndc_code
                when m.atc_system is not null then m.atc_code
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                           as source_code
    ,   cast(
            case 
                when m.rxnorm_system is not null then m.rxnorm_display
                when m.ndc_system is not null then m.ndc_display
                when m.atc_system is not null then m.atc_display
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                           as source_description
    ,   cast(m.ndc_code as {{ dbt.type_string() }} )                                                as ndc_code
    ,   cast(m.ndc_display as {{ dbt.type_string() }} )                                             as ndc_description
    ,   cast(m.rxnorm_code as {{ dbt.type_string() }} )                                             as rxnorm_code
    ,   cast(m.rxnorm_display as {{ dbt.type_string() }} )                                          as rxnorm_description
    ,   cast(m.atc_code as {{ dbt.type_string() }} )                                                as atc_code
    ,   cast(m.atc_display as {{ dbt.type_string() }} )                                             as atc_description
    ,   cast(m.dosage_0_route_coding_0_display as {{ dbt.type_string() }} )                         as route
    ,   cast(null as {{ dbt.type_string() }} )                                                      as strength
    ,   cast(
            case 
                when m.dosage_0_doseandrate_0_dosequantity_value <> '' 
                    then m.dosage_0_doseandrate_0_dosequantity_value
                else null
            end as {{ dbt.type_int() }} 
        )                                                                                           as quantity
    ,   cast(m.dosage_0_doseandrate_0_dosequantity_unit as {{ dbt.type_string() }} )                as quantity_unit
    ,   cast(null as {{ dbt.type_int() }} )                                                         as days_supply
    ,   cast(null as {{ dbt.type_string() }} )                                                      as practitioner_id
    ,   cast(m.medication_statement_status as {{ dbt.type_string() }} )                             as status
    ,   cast(m.medication_statement_meta_source as {{ dbt.type_string() }} )                        as data_source
from medication_statements_with_codings as m
left join {{ref('stage__patient') }} p
    on right(m.subject_reference, 36) = p.id
