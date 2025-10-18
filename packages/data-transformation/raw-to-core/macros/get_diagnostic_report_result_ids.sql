{% macro get_diagnostic_report_result_ids(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            right(result_{{i}}_reference, 36)  as observation_id
        ,   id                                 as diagnostic_report_id
    from {{ref(stage_table)}}
    where  result_{{i}}_reference != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
