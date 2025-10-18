{% macro generate_tuple_from_list(list) %}
    (
        {%- for item in list -%}
            '{{ item }}'
            {%- if not loop.last -%}
                ,
            {%- endif -%}
        {%- endfor -%}
    )
{% endmacro %}
