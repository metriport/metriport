{% macro get_diagnostic_report_result_references(max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id                                          as diagnostic_report_id
        ,   'result'                                    as property,
        ,   right(result_{{i}}_reference, 36)           as reference_id
        ,   replace(
                result_{{i}}_reference,
                conat(
                    '/', 
                    right(result_{{i}}_reference, 36)
                ),
                ''
            )                                           as reference_type
    from {{ref('stage__diagnosticreport')}}
    where result_{{i}}_reference != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
