
-- SELECT statement for MedicationDispense
SELECT 
    filename,
    processed_date 
FROM {{source('raw', 'medicationdispense') }} x

QUALIFY rank() over(partition by filename order by processed_date desc) = 1