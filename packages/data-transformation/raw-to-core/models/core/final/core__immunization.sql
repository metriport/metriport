select
      immune.immunization_id
    , immune.person_id
    , immune.patient_id
    , immune.encounter_id
    , immune.source_code_type
    , immune.source_code
    , immune.source_description
    , case
        when immune.normalized_code_type is not null then immune.normalized_code_type
        when cvx.cvx is not null then 'cvx'
        else null end as normalized_code_type
    , coalesce(
        immune.normalized_code
        , cvx.cvx
        ) as normalized_code
    , coalesce(
        immune.normalized_description
        , cvx.long_description
        ) as normalized_description
    , case when coalesce(immune.normalized_code, immune.normalized_description) is not null then 'manual'
         when cvx.cvx is not null then 'automatic'
         end as mapping_method
    , coalesce(immunization_status.status, immune.status) as status
    , coalesce(immunization_status_reason.description, immune.status_reason) as status_reason
    , immune.occurrence_date
    , immune.source_dose
    , immune.normalized_dose
    , immune.lot_number
    , coalesce(act_site.description, immune.body_site) as body_site
    , coalesce(immunization_route.description, immune.route) as route
    , immune.location_id
    , immune.practitioner_id
    , immune.data_source
    , immune.tuva_last_run
from {{ ref('core__stg_clinical_immunization') }} as immune
left outer join {{ ref('terminology__cvx') }} as cvx
    on immune.source_code_type = 'cvx'
        and immune.source_code = cvx.cvx
left outer join {{ ref('terminology__immunization_status') }} as immunization_status
    on immune.status = immunization_status.status_code
left outer join {{ ref('terminology__immunization_status_reason') }} as immunization_status_reason
    on immune.status_reason = immunization_status_reason.reason_code
        and (
        immunization_status_reason.code_type = 'actreason' or
        immunization_status_reason.code_type = 'snomed-ct'
        )
left outer join {{ ref('terminology__act_site') }} as act_site
    on immune.body_site = act_site.body_code
left outer join {{ ref('terminology__immunization_route_code') }} as immunization_route
    on immune.route = immunization_route.route_code
