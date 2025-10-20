{% macro get_medication_request_reason_references(max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id                                                  as medication_request_id
        ,   'reason_reference'                                  as property
        ,   right(reasonreference_{{i}}_reference, 36)          as reference_id
        ,   replace(
                reasonreference_{{i}}_reference,
                concat(
                    '/', 
                    right(reasonreference_{{i}}_reference, 36)
                ),
                ''
            )                                                   as reference_type
    from {{ref('stage__medicationrequest')}}
    where reasonreference_{{i}}_reference != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
