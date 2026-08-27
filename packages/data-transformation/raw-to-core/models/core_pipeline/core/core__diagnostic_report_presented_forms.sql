{{ config(unique_key='m_patient_id') }}

select
        s.id as diagnostic_report_id
    ,   t.data
    ,   t.content_type
    ,   t.creation
    ,   t.hash
    ,   t.language
    ,   t.size
    ,   t.title
    ,   t.url
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__diagnosticreport')}} s
cross join lateral unnest(
    array[
        s.presentedform_00_data, s.presentedform_01_data, s.presentedform_02_data, s.presentedform_03_data, s.presentedform_04_data,
        s.presentedform_05_data, s.presentedform_06_data, s.presentedform_07_data, s.presentedform_08_data, s.presentedform_09_data,
        s.presentedform_10_data, s.presentedform_11_data, s.presentedform_12_data, s.presentedform_13_data, s.presentedform_14_data,
        s.presentedform_15_data, s.presentedform_16_data, s.presentedform_17_data, s.presentedform_18_data, s.presentedform_19_data,
        s.presentedform_20_data, s.presentedform_21_data, s.presentedform_22_data, s.presentedform_23_data, s.presentedform_24_data,
        s.presentedform_25_data, s.presentedform_26_data, s.presentedform_27_data, s.presentedform_28_data, s.presentedform_29_data
    ],
    array[
        s.presentedform_00_contenttype, s.presentedform_01_contenttype, s.presentedform_02_contenttype, s.presentedform_03_contenttype, s.presentedform_04_contenttype,
        s.presentedform_05_contenttype, s.presentedform_06_contenttype, s.presentedform_07_contenttype, s.presentedform_08_contenttype, s.presentedform_09_contenttype,
        s.presentedform_10_contenttype, s.presentedform_11_contenttype, s.presentedform_12_contenttype, s.presentedform_13_contenttype, s.presentedform_14_contenttype,
        s.presentedform_15_contenttype, s.presentedform_16_contenttype, s.presentedform_17_contenttype, s.presentedform_18_contenttype, s.presentedform_19_contenttype,
        s.presentedform_20_contenttype, s.presentedform_21_contenttype, s.presentedform_22_contenttype, s.presentedform_23_contenttype, s.presentedform_24_contenttype,
        s.presentedform_25_contenttype, s.presentedform_26_contenttype, s.presentedform_27_contenttype, s.presentedform_28_contenttype, s.presentedform_29_contenttype
    ],
    array[
        s.presentedform_00_creation, s.presentedform_01_creation, s.presentedform_02_creation, s.presentedform_03_creation, s.presentedform_04_creation,
        s.presentedform_05_creation, s.presentedform_06_creation, s.presentedform_07_creation, s.presentedform_08_creation, s.presentedform_09_creation,
        s.presentedform_10_creation, s.presentedform_11_creation, s.presentedform_12_creation, s.presentedform_13_creation, s.presentedform_14_creation,
        s.presentedform_15_creation, s.presentedform_16_creation, s.presentedform_17_creation, s.presentedform_18_creation, s.presentedform_19_creation,
        s.presentedform_20_creation, s.presentedform_21_creation, s.presentedform_22_creation, s.presentedform_23_creation, s.presentedform_24_creation,
        s.presentedform_25_creation, s.presentedform_26_creation, s.presentedform_27_creation, s.presentedform_28_creation, s.presentedform_29_creation
    ],
    array[
        s.presentedform_00_hash, s.presentedform_01_hash, s.presentedform_02_hash, s.presentedform_03_hash, s.presentedform_04_hash,
        s.presentedform_05_hash, s.presentedform_06_hash, s.presentedform_07_hash, s.presentedform_08_hash, s.presentedform_09_hash,
        s.presentedform_10_hash, s.presentedform_11_hash, s.presentedform_12_hash, s.presentedform_13_hash, s.presentedform_14_hash,
        s.presentedform_15_hash, s.presentedform_16_hash, s.presentedform_17_hash, s.presentedform_18_hash, s.presentedform_19_hash,
        s.presentedform_20_hash, s.presentedform_21_hash, s.presentedform_22_hash, s.presentedform_23_hash, s.presentedform_24_hash,
        s.presentedform_25_hash, s.presentedform_26_hash, s.presentedform_27_hash, s.presentedform_28_hash, s.presentedform_29_hash
    ],
    array[
        s.presentedform_00_language, s.presentedform_01_language, s.presentedform_02_language, s.presentedform_03_language, s.presentedform_04_language,
        s.presentedform_05_language, s.presentedform_06_language, s.presentedform_07_language, s.presentedform_08_language, s.presentedform_09_language,
        s.presentedform_10_language, s.presentedform_11_language, s.presentedform_12_language, s.presentedform_13_language, s.presentedform_14_language,
        s.presentedform_15_language, s.presentedform_16_language, s.presentedform_17_language, s.presentedform_18_language, s.presentedform_19_language,
        s.presentedform_20_language, s.presentedform_21_language, s.presentedform_22_language, s.presentedform_23_language, s.presentedform_24_language,
        s.presentedform_25_language, s.presentedform_26_language, s.presentedform_27_language, s.presentedform_28_language, s.presentedform_29_language
    ],
    array[
        s.presentedform_00_size, s.presentedform_01_size, s.presentedform_02_size, s.presentedform_03_size, s.presentedform_04_size,
        s.presentedform_05_size, s.presentedform_06_size, s.presentedform_07_size, s.presentedform_08_size, s.presentedform_09_size,
        s.presentedform_10_size, s.presentedform_11_size, s.presentedform_12_size, s.presentedform_13_size, s.presentedform_14_size,
        s.presentedform_15_size, s.presentedform_16_size, s.presentedform_17_size, s.presentedform_18_size, s.presentedform_19_size,
        s.presentedform_20_size, s.presentedform_21_size, s.presentedform_22_size, s.presentedform_23_size, s.presentedform_24_size,
        s.presentedform_25_size, s.presentedform_26_size, s.presentedform_27_size, s.presentedform_28_size, s.presentedform_29_size
    ],
    array[
        s.presentedform_00_title, s.presentedform_01_title, s.presentedform_02_title, s.presentedform_03_title, s.presentedform_04_title,
        s.presentedform_05_title, s.presentedform_06_title, s.presentedform_07_title, s.presentedform_08_title, s.presentedform_09_title,
        s.presentedform_10_title, s.presentedform_11_title, s.presentedform_12_title, s.presentedform_13_title, s.presentedform_14_title,
        s.presentedform_15_title, s.presentedform_16_title, s.presentedform_17_title, s.presentedform_18_title, s.presentedform_19_title,
        s.presentedform_20_title, s.presentedform_21_title, s.presentedform_22_title, s.presentedform_23_title, s.presentedform_24_title,
        s.presentedform_25_title, s.presentedform_26_title, s.presentedform_27_title, s.presentedform_28_title, s.presentedform_29_title
    ],
    array[
        s.presentedform_00_url, s.presentedform_01_url, s.presentedform_02_url, s.presentedform_03_url, s.presentedform_04_url,
        s.presentedform_05_url, s.presentedform_06_url, s.presentedform_07_url, s.presentedform_08_url, s.presentedform_09_url,
        s.presentedform_10_url, s.presentedform_11_url, s.presentedform_12_url, s.presentedform_13_url, s.presentedform_14_url,
        s.presentedform_15_url, s.presentedform_16_url, s.presentedform_17_url, s.presentedform_18_url, s.presentedform_19_url,
        s.presentedform_20_url, s.presentedform_21_url, s.presentedform_22_url, s.presentedform_23_url, s.presentedform_24_url,
        s.presentedform_25_url, s.presentedform_26_url, s.presentedform_27_url, s.presentedform_28_url, s.presentedform_29_url
    ]
) with ordinality as t(data, content_type, creation, hash, language, size, title, url, form_index)
where t.data is not null 
    and t.data != ''
    and (
        s.presentedform_00_data is not null or s.presentedform_01_data is not null or s.presentedform_02_data is not null or
        s.presentedform_03_data is not null or s.presentedform_04_data is not null or s.presentedform_05_data is not null or
        s.presentedform_06_data is not null or s.presentedform_07_data is not null or s.presentedform_08_data is not null or
        s.presentedform_09_data is not null or s.presentedform_10_data is not null or s.presentedform_11_data is not null or
        s.presentedform_12_data is not null or s.presentedform_13_data is not null or s.presentedform_14_data is not null or
        s.presentedform_15_data is not null or s.presentedform_16_data is not null or s.presentedform_17_data is not null or
        s.presentedform_18_data is not null or s.presentedform_19_data is not null or s.presentedform_20_data is not null or
        s.presentedform_21_data is not null or s.presentedform_22_data is not null or s.presentedform_23_data is not null or
        s.presentedform_24_data is not null or s.presentedform_25_data is not null or s.presentedform_26_data is not null or
        s.presentedform_27_data is not null or s.presentedform_28_data is not null or s.presentedform_29_data is not null
    )
