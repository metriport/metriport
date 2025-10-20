{% macro get_procedure_report_references(max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id                                          as procedure_id
        ,   'report'                                    as property,
        ,   right(reportreference_{{i}}_reference, 36)           as reference_id
        ,   replace(
                reportreference_{{i}}_reference,
                conat(
                    '/', 
                    right(reportreference_{{i}}_reference, 36)
                ),
                ''
            )                                           as reference_type
    from {{ref('stage__diagnosticreport')}}
    where reportreference_{{i}}_reference != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
