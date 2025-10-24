{% macro get_multiple_references(
    stage_table_name,
    max_index,
    resource_id_field,  
    reference_property,
    reference_id_field_prefix,
    reference_id_field_suffix
)%}
    {% for i in range(max_index + 1) %}
    {% set formatted_index = i|string %}
    {% if max_index > 9 %}
        {% set formatted_index = "%02d"|format(i) %}
    {% endif %}
    select
        id                                                                                                  as {{resource_id_field}}
    ,   '{{reference_property}}'                                                                            as property
    ,   right({{reference_id_field_prefix}}_{{formatted_index}}_{{reference_id_field_suffix}}, 36)          as reference_id
    ,   replace(
            {{reference_id_field_prefix}}_{{formatted_index}}_{{reference_id_field_suffix}},
            concat(
                '/', 
                right({{reference_id_field_prefix}}_{{formatted_index}}_{{reference_id_field_suffix}}, 36)
            ),
            ''
        )                                                                                                   as reference_type
    from {{ref(stage_table_name)}}
    where {{reference_id_field_prefix}}_{{formatted_index}}_{{reference_id_field_suffix}} != '' 
        and {{reference_id_field_prefix}}_{{formatted_index}}_{{reference_id_field_suffix}} is not null
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
