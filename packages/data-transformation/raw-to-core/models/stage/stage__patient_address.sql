
-- SELECT statement for Patient_address
SELECT 
    patient_id,
    line_0,
    city,
    state,
    postalcode,
    country,
    line_1,
    filename,
    processed_date 
FROM {{source('raw', 'patient_address') }} x

QUALIFY rank() over(partition by filename order by processed_date desc) = 1