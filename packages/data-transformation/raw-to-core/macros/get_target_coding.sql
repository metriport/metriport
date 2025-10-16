{% macro get_target_coding(
    codings_macro_name, 
    codings_macro_stage_table, 
    codings_macro_id_field,
    codings_macro_max_index, 
    codings_macro_secondary_max_index,
    target_code_system
)%}
    with codings as (
        {% if codings_macro_secondary_max_index is not none %}
            {{ codings_macro_name(codings_macro_stage_table, codings_macro_max_index, codings_macro_secondary_max_index) }}
        {% else %}
            {{ codings_macro_name(codings_macro_stage_table, codings_macro_max_index) }}
        {% endif %}
    )
    select *
    from codings
    where system = '{{ target_code_system }}' 
    limit 1
{% endmacro %}
