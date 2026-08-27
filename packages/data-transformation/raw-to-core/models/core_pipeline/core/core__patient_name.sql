{{ config(unique_key='m_patient_id') }}

with base as (
    select
        {{ try_to_cast_string('pn.patient_id') }} as patient_id,
        {{ try_to_cast_string('pn.family') }} as family,
        {{ try_to_cast_string('pn.given_0') }} as given_0,
        {{ try_to_cast_string('pn.given_1') }} as given_1,
        {{ try_to_cast_string('pn.given_2') }} as given_2,
        {{ try_to_cast_string('pn.given_3') }} as given_3,
        {{ try_to_cast_string('pn.given_4') }} as given_4,
        {{ try_to_cast_string('pn.given_5') }} as given_5,
        {{ try_to_cast_string('pn.given_6') }} as given_6,
        {{ try_to_cast_string('pn.given_7') }} as given_7,
        {{ try_to_cast_string('pn.given_8') }} as given_8,
        {{ try_to_cast_string('pn.given_9') }} as given_9,
        {{ try_to_cast_string('pn.prefix_0') }} as prefix_0,
        {{ try_to_cast_string('pn.prefix_1') }} as prefix_1,
        {{ try_to_cast_string('pn.prefix_2') }} as prefix_2,
        {{ try_to_cast_string('pn.prefix_3') }} as prefix_3,
        {{ try_to_cast_string('pn.prefix_4') }} as prefix_4,
        {{ try_to_cast_string('pn.suffix_0') }} as suffix_0,
        {{ try_to_cast_string('pn.suffix_1') }} as suffix_1,
        {{ try_to_cast_string('pn.suffix_2') }} as suffix_2,
        {{ try_to_cast_string('pn.suffix_3') }} as suffix_3,
        {{ try_to_cast_string('pn.suffix_4') }} as suffix_4,
        row_number() over (partition by pn.patient_id order by pn.anchor_index) as name_rank,
        {{ get_inline_demographic_source(4) }} as data_source_ext,
        pn.m_patient_id,
        pn.m_job_id,
        pn.m_created_at,
        pn.m_updated_at,
        pn.m_deleted_at,
        pn.raw_to_core_job_id
    from {{ ref("stage__patient_name") }} pn
)
select
    patient_id,
    family as last_name,
    given_0 as first_name,
    case 
        when given_0 is null and given_1 is null and given_2 is null and given_3 is null and given_4 is null 
             and given_5 is null and given_6 is null and given_7 is null and given_8 is null and given_9 is null 
        then null
        else 
        {% if target.name == 'postgres' %}
            array_remove(ARRAY[given_0, given_1, given_2, given_3, given_4, given_5, given_6, given_7, given_8, given_9], NULL)
        {% else %}
            array_construct_compact(given_0, given_1, given_2, given_3, given_4, given_5, given_6, given_7, given_8, given_9)
        {% endif %}
    end as given_names,
    case 
        when suffix_0 is null and suffix_1 is null and suffix_2 is null and suffix_3 is null and suffix_4 is null 
        then null
        else 
        {% if target.name == 'postgres' %}
            array_remove(ARRAY[suffix_0, suffix_1, suffix_2, suffix_3, suffix_4], NULL)
        {% else %}
            array_construct_compact(suffix_0, suffix_1, suffix_2, suffix_3, suffix_4)
        {% endif %}
    end as suffixes,
    case 
        when prefix_0 is null and prefix_1 is null and prefix_2 is null and prefix_3 is null and prefix_4 is null 
        then null
        else 
        {% if target.name == 'postgres' %}
            array_remove(ARRAY[prefix_0, prefix_1, prefix_2, prefix_3, prefix_4], NULL)
        {% else %}
            array_construct_compact(prefix_0, prefix_1, prefix_2, prefix_3, prefix_4)
        {% endif %}
    end as prefixes,
    name_rank,
    data_source_ext,
    m_patient_id,
    m_job_id,
    m_created_at,
    m_updated_at,
    m_deleted_at,
    raw_to_core_job_id
from base
