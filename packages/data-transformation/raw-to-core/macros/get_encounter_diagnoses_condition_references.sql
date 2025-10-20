{% macro get_encounter_diagnose_condition_references(max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id                                                  as encounter_id
        ,   'diagnosis.condition'                               as property
        ,   right(diagnosis_{{i}}_condition_reference, 36)      as reference_id
        ,   replace(
                diagnosis_{{i}}_condition_reference,
                concat(
                    '/', 
                    right(diagnosis_{{i}}_condition_reference, 36)
                ),
                ''
            )                                                   as reference_type
    from {{ref('stage__encounter')}}
    where diagnosis_{{i}}_condition_reference != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
