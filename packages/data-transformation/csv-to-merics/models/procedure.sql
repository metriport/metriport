select
  cast(pro.id as {{ dbt.type_string() }} )                      as procedure_id
, cast(pat.id as {{ dbt.type_string() }} )                      as patient_id
, cast(null as {{ dbt.type_string() }} )                        as encounter_id
, cast(null as {{ dbt.type_string() }} )                        as claim_id
, cast(pro.performeddatetime  as date)                          as procedure_date
, cast(case code_coding_0_system
        when 'http://www.ama-assn.org/go/cpt' then 'cpt'
        when 'http://loinc.org' then 'loinc'
        when 'http://snomed.info/sct' then 'snomed-ct'
        when 'http://www.ada.org/cdt' then 'cdt'
        when 'urn:oid:2.16.840.1.113883.6.285' then 'hcpcs'
        else
            case 
                when code_coding_0_system like '%1.2.840.114350.1%' 
                then 'epic' end end as {{ dbt.type_string() }} ) as source_code_type
, cast(pro.code_coding_0_code as {{ dbt.type_string() }} )      as source_code
, cast(pro.code_text as {{ dbt.type_string() }} )               as source_description
, cast(case
        when hcpcs.hcpcs is not null then 'hcpcs'
        when snomed.snomed_ct is not null then 'snomed-ct'
        when loinc.loinc is not null then 'loinc'
        when pro.code_coding_0_system = 'http://www.ama-assn.org/go/cpt' then 'cpt' end
        as {{ dbt.type_string() }} ) as normalized_code_type
, cast(coalesce(
            hcpcs.hcpcs,
            snomed.snomed_ct,
            loinc.loinc,
            case when pro.code_coding_0_system = 'http://www.ama-assn.org/go/cpt'
                then pro.code_coding_0_code end
            ) as {{ dbt.type_string() }} ) as normalized_code
, cast(coalesce(hcpcs.long_description,
    snomed.description,
    loinc.long_common_name,
                  case when pro.code_coding_0_system = 'http://www.ama-assn.org/go/cpt'
                    then pro.code_text end
            ) as {{ dbt.type_string() }} ) as normalized_description
, cast(null as {{ dbt.type_string() }} ) as modifier_1
, cast(null as {{ dbt.type_string() }} ) as modifier_2
, cast(null as {{ dbt.type_string() }} ) as modifier_3
, cast(null as {{ dbt.type_string() }} ) as modifier_4
, cast(null as {{ dbt.type_string() }} ) as modifier_5
, cast(right(pro.{{ protected_columns('PERFORMER_0_ACTOR_REFERENCE') }}, 36) as {{ dbt.type_string() }} ) as practitioner_id
, cast('metriport' as {{ dbt.type_string() }} ) as data_source
from {{ ref('stage__procedure' ) }} pro
left join {{ ref('stage__patient' ) }} pat
    on right(pro.subject_reference, 36) = pat.id
left join {{ref('terminology__hcpcs_level_2')}} hcpcs
    on code_coding_0_system in ('urn:oid:2.16.840.1.113883.6.285','http://www.ama-assn.org/go/cpt')
    and pro.code_coding_0_code = hcpcs.hcpcs
left join {{ref('terminology__snomed_ct')}} snomed
    on pro.code_coding_0_system = 'http://snomed.info/sct'
    and pro.code_coding_0_code = snomed.snomed_ct
left join {{ref('terminology__loinc')}} loinc
    on pro.code_coding_0_system = 'http://loinc.org'
    and pro.code_coding_0_code = loinc.loinc

