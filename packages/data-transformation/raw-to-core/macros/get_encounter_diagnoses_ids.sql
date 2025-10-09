{% macro get_encounter_diagnoses_ids(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            right(diagnosis_{{i}}_condition_reference, 36)  as condition_id
        ,   id                                              as encounter_id
    from {{ref(stage_table)}}
    where  diagnosis_{{i}}_condition_reference != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}