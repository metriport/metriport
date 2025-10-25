SELECT 
    city,
    country,
    line_0,
    line_1,
    patient_id,
    postalcode,
    state,
    filename,
    processed_date
FROM {{ source("raw", "patient_address_view" if target.name == "postgres" else "patient_address") }}
