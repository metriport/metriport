{% macro get_single_reference(
    stage_table_name,
    resource_id_field,  
    reference_property,
    reference_id_field
)%}
    select
        id                                          as {{resource_id_field}}
    ,   '{{reference_property}}'                    as property
    ,   right({{reference_id_field}}, 36)           as reference_id
    ,   replace(
            {{reference_id_field}},
            concat(
                '/', 
                right({{reference_id_field}}, 36)
            ),
            ''
        )                                           as reference_type
    from {{ref(stage_table_name)}}
    where {{reference_id_field}} != ''
{% endmacro %}
