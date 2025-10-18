{% macro get_medication_statement_reason_ids(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            right(reasonreference_{{i}}_reference, 36)  as condition_id
        ,   id                                          as medication_statement_id
    from {{ref(stage_table)}}
    where  reasonreference_{{i}}_reference != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
