{% macro get_procedure_reason_ids(stage_table, max_index) %}
    {% for i in range(1) %}
    select
            right(reasonreference_reference, 36)        as condition_id
        ,   id                                          as medication_request_id
    from {{ref(stage_table)}}
    where  reasonreference_reference != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
