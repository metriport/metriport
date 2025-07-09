WITH address AS (
    SELECT *
    FROM {{ ref('stage__patient_address') }}
)

select pat.id                                                   as patient_id
      , pat.name_0_given_0                                      as first_name
      , pat.name_0_family                                       as last_name
      , pat.gender                                              as sex
      , null                                                    as race
      , pat.birthdate                                           as birth_date
      , {{ try_to_cast_date('null', 'YYYY-MM-DD') }}            as death_date
      , null                                                    as death_flag
      , null                                                    as subscriber_id
      , null                                                    as social_security_number
      , address.line_0 || coalesce(' ' || address.line_1, '')   as address
      , address.city                                            as city
      , address.state                                           as state
      , address.postalcode                                      as zip_code
      , null                                                    as county
      , null                                                    as latitude
      , null                                                    as longitude
      , 'metriport'                                            as data_source
from {{ ref('stage__patient') }}                               as pat
    left join address on pat.id = address.patient_id