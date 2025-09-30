with sources as (
    select *,
      medstmt.id as medicationstatement_id,
      -- RxNorm code and display
      {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'code') }} as rxnorm_code,
      {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'system') }} as rxnorm_system,
      {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'display') }} as rxnorm_display,

      -- NDC code and display
      {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'code') }} as ndc_code,
      {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'system') }} as ndc_system,
      {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'display') }} as ndc_display,

      -- ATC code and display
      {{ get_coding_value('http://www.whocc.no/atc', 'code') }} as atc_code,
      {{ get_coding_value('http://www.whocc.no/atc', 'system') }} as atc_system,
      {{ get_coding_value('http://www.whocc.no/atc', 'display') }} as atc_display,

      case when {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'system') }} is not null then 'rxnorm'
          when {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'system') }} is not null then 'ndc'
          when {{ get_coding_value('http://www.whocc.no/atc', 'system') }} is not null then 'atc'
          else 'unknown' 
      end as source_code_type,

      case when {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'system') }} is not null then {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'code') }}
          when {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'system') }} is not null then {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'code') }} 
          when {{ get_coding_value('http://www.whocc.no/atc', 'system') }}  is not null then {{ get_coding_value('http://www.whocc.no/atc', 'code') }} 
          else 'unknown' 
      end as source_code,

      case when {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'system') }} is not null then {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'display') }}
          when {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'system') }} is not null then {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'display') }}
          when {{ get_coding_value('http://www.whocc.no/atc', 'system') }} is not null then {{ get_coding_value('http://www.whocc.no/atc', 'display') }}
          else 'unknown' 
      end as source_display,

       -- Primary source determination (ordered by priority)
       row_number() over (partition by medstmt.id
           order by case 
              when {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'system') }} is not null then 0
              when {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'system') }} is not null then 1
              when {{ get_coding_value('http://www.whocc.no/atc', 'system') }} is not null then 2
              else 999 end
       ) as src_ord
  from {{ref('stage__medicationstatement')}} medstmt
  inner join {{ref('stage__medication') }} med
    on right(medstmt.medicationreference_reference, 36) = med.id
)
select
      cast(medstmt.id as {{ dbt.type_string() }} )                                                  as medication_id
    , cast(p.id as {{ dbt.type_string() }} )                                                        as patient_id
    , cast(null as {{ dbt.type_string() }} )                                                        as encounter_id
    , cast(null as date)                                                                            as dispensing_date
    , {{ try_to_cast_date('medstmt.effectiveperiod_start') }}                                       as prescribing_date
    , cast(sources.source_code_type as {{ dbt.type_string() }} )                                    as source_code_type
    , cast(sources.source_code as {{ dbt.type_string() }} )                                         as source_code
    , cast(sources.source_display as {{ dbt.type_string() }} )                                      as source_description
    , cast(sources.ndc_code as {{ dbt.type_string() }} )                                            as ndc_code
    , cast(sources.ndc_display as {{ dbt.type_string() }} )                                         as ndc_description
    , cast(sources.rxnorm_code as {{ dbt.type_string() }} )                                         as rxnorm_code
    , cast(sources.rxnorm_display as {{ dbt.type_string() }} )                                      as rxnorm_description
    , cast(sources.atc_code as {{ dbt.type_string() }} )                                            as atc_code
    , cast(sources.atc_display as {{ dbt.type_string() }} )                                         as atc_description
    , cast(medstmt.dosage_0_route_coding_0_display as {{ dbt.type_string() }} )                     as route
    , cast(null as {{ dbt.type_string() }} )                                                        as strength
    , cast(medstmt.dosage_0_doseandrate_0_dosequantity_value as {{ dbt.type_int() }} )              as quantity
    , cast(medstmt.dosage_0_doseandrate_0_dosequantity_unit as {{ dbt.type_string() }} )            as quantity_unit
    , cast(null as {{ dbt.type_int() }} )                                                           as days_supply
    , cast(medreq.requester_reference as {{ dbt.type_string() }} )                                  as practitioner_id
    , cast(medstmt.meta_source as {{ dbt.type_string() }} )                                         as data_source
from {{ref('stage__medicationstatement')}} medstmt
left join {{ref('stage__patient') }} p
    on right(medstmt.subject_reference, 36) = p.id
inner join {{ref('stage__medication') }} med
    on right(medstmt.medicationreference_reference, 36) = med.id
left join {{ ref('stage__medicationrequest') }} medreq
    on right(medreq.medicationreference_reference, 36) = med.id
left join sources
    on medstmt.id = sources.medicationstatement_id
