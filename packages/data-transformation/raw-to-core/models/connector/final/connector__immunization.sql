select
      cast(i.id as {{ dbt.type_string() }} )                                                            as immunization_id
    , cast(p.id as {{ dbt.type_string() }} )                                                            as patient_id
    , cast(null as {{ dbt.type_string() }} )                                                            as encounter_id
    , cast(i.vaccinecode_coding_0_system as {{ dbt.type_string() }} )                                   as source_code_type
    , cast(i.vaccinecode_coding_0_code as {{ dbt.type_string() }} )                                     as source_code
    , cast(i.vaccinecode_coding_0_display as {{ dbt.type_string() }} )                                  as source_description
    , cast('cvx' as {{ dbt.type_string() }} )                                                           as normalized_code_type
    , cast(i.vaccinecode_coding_0_code as {{ dbt.type_string() }} )                                     as normalized_code
    , cast(i.vaccinecode_coding_0_display as {{ dbt.type_string() }} )                                  as normalized_description
    , cast(i.status as {{ dbt.type_string() }} )                                                        as status
    , cast(i.statusreason_text as {{ dbt.type_string() }} )                                             as status_reason
    , {{ try_to_cast_date('i.occurrencedatetime') }}                                                    as occurrence_date
    , cast(i.dosequantity_value as {{ dbt.type_string() }} )                                            as source_dose
    , cast(i.dosequantity_value as {{ dbt.type_string() }} )                                            as normalized_dose
    , cast(i.lotnumber as {{ dbt.type_string() }} )                                                     as lot_number
    , cast(i.site_coding_0_display as {{ dbt.type_string() }} )                                         as body_site
    , cast(i.route_coding_0_display as {{ dbt.type_string() }} )                                        as route
    , cast(null as {{ dbt.type_string() }} )                                                            as location_id
    , cast(right(i.performer_0_actor_reference, 36) as {{ dbt.type_string() }} )                        as practitioner_id
    , cast('metriport' as {{ dbt.type_string() }} )                                                     as data_source
from {{ref('stage__immunization')}} i
left join {{ref('stage__patient')}} p
    on right(i.patient_reference, 36) = p.id
