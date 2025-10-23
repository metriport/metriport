{#
    This macro includes options for compression, headers, and null markers.
    Default options are set to FALSE. When set to TRUE, the appropriate
    adapter-specific syntax will be used.

    Argument examples:
    compression=false
    compression=true
    headers=false
    headers=true
    null_marker=false
    null_marker=true
#}

{% macro load_seed(uri,pattern,compression=false,headers=false,null_marker=false) %}

    {{ return(adapter.dispatch('load_seed', 'the_tuva_project')(uri,pattern,compression,headers,null_marker)) }}

{% endmacro %}

-- postgres - note this requires some pre-work on your part -  you need to clone
-- the data from the tuva public resource bucket to re-assemble it into a single
-- file per seed with quoted null's unquoted - also ensure you've set the
-- Content-Type system header on each to be gzip
-- (https://stackoverflow.com/a/74439053) otherwise the extension won't know to
-- decompress it.
--
-- TODO: revisit removing column list, I think it'll work fine with '' for cols
{% macro postgres__load_seed(uri,pattern,compression,headers,null_marker) %}

    {%- set columns = adapter.get_columns_in_relation(this) -%}
    {%- set collist = [] -%}
    {%- for col in columns -%}
    {%- do collist.append(col.name) -%}
    {%- endfor -%}
    {%- set cols = collist|join(",") -%}

    {%- set s3_bucket = var("tuva_seeds_s3_bucket", uri.split("/")[0]) -%}
    {%- set s3_key = uri.split("/")[1:]|join("/") + "/" + pattern + "_0.csv.gz" -%}
    {%- if var("tuva_seeds_s3_key_prefix", "") != "" -%}
    {%- set s3_key = var("tuva_seeds_s3_key_prefix") + "/" + s3_key -%}
    {%- endif -%}
    {%- set s3_region = "us-east-1" -%}
    {%- set options = ["(", "format csv", ", encoding ''utf8''"] -%}
    {%- do options.append(", null ''\\N''") if null_marker == true -%}
    {%- do options.append(")") -%}
    {%- set options_s = options | join("") -%}

    {% set sql %}
    SELECT aws_s3.table_import_from_s3(
    '{{ this }}',
    '{{ cols }}',
    '{{ options_s }}',
    aws_commons.create_s3_uri('{{s3_bucket}}', '{{s3_key}}', '{{s3_region}}')
    )
    {% endset %}

    {% call statement('postgressql',fetch_result=true) %}
    {{ sql }}
    {% endcall %}

    {% if execute %}
    {# debugging { log(sql, True)} #}
    {% set results = load_result('postgressql') %}
    {{ log("Loaded data from external s3 resource\n  loaded to: " ~ this ~ "\n  from: s3://" ~ s3_bucket ~ "/" ~ s3_key ,True) }}
    {# debugging { log(results, True) } #}
    {% endif %}

    {% endmacro %}


    {% macro default__load_seed(uri,pattern,compression,headers,null_marker) %}
    {% if execute %}
    {% do log('No adapter found, seed not loaded',info = True) %}
    {% endif %}

{% endmacro %}

{% macro snowflake__load_seed(uri,pattern,compression,headers,null_marker) %}
    {% set sql %}
    copy into {{ this }}
        from s3://{{ uri }}
        file_format = (
        type = CSV
        {% if compression == true %} compression = 'GZIP' {% else %} compression = 'none' {% endif %}
        {% if headers == true %} skip_header = 1
        {% endif %}
        empty_field_as_null = true
        field_optionally_enclosed_by = '"'
        /* Crucial: also treat quoted empties "" as NULL */
        {% if null_marker == true %}
        null_if = ('', '""', 'NULL', '\\N')
        {% else %}
        /* At minimum, handle both empty and quoted-empty */
        null_if = ('', '""')
        {% endif %}
    )
    pattern = '.*\/{{pattern}}.*';
    {% endset %}
    {% call statement('snowsql',fetch_result=true) %}
    {{ sql }}
    {% endcall %}

    {% if execute %}
    {# debugging { log(sql, True)} #}
    {% set results = load_result('snowsql') %}
    {{ log("Loaded data from external s3 resource\n  loaded to: " ~ this ~ "\n  from: s3://" ~ uri ~ "/" ~ pattern ~ "*\n  rows: " ~ results['data']|sum(attribute=2),True) }}
    {# debugging { log(results, True)} #}
    {% endif %}

{% endmacro %}

{% macro athena__load_seed(uri, pattern, compression, headers, null_marker) %}

  {% if execute %}
        {%- set columns = adapter.get_columns_in_relation(this) -%}
        {%- set column_definitions = [] -%}
        {%- set null_char = '\\N' if null_marker else '' -%}

        {% for col in columns %}
            {% do column_definitions.append(col.name ~ " string" ) %}
        {% endfor %}

        {%- set col_ddl = column_definitions|join(',') -%}

        {% set bucket = 's3://' ~ uri ~ '/' %}
        {% set full_path = bucket  ~ pattern %}
        {% set table_name = this.schema ~ '.' ~  this.name %}
        {% set tmp_table = this.schema ~ '.' ~  this.name ~ "__dbt_tmp_external" %}
        {% set header_line_count %}{% if headers -%}1{%- else -%}0{%- endif -%}{% endset %}


        {% set drop_tmp_table %}
            DROP TABLE IF EXISTS `{{ tmp_table }}`;
        {% endset %}
        {% set create_tmp_table %}
            CREATE EXTERNAL TABLE `{{ tmp_table }}` ( {{ col_ddl }} )
            ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
            STORED AS TEXTFILE
            LOCATION '{{ bucket }}'
            TBLPROPERTIES (
              'skip.header.line.count'='{{ header_line_count }}'
              {%- if compression -%}, 'compressionType'='GZIP'{%- endif -%}
            );
        {% endset %}

        {% set drop_seed_table %}
            DROP TABLE IF EXISTS `{{ table_name }}`;
        {% endset %}
        {% set create_seed_table %}
            CREATE TABLE {{ table_name }} AS
                SELECT
                {% for col in columns %}
                    cast(nullif({{ col.name }},'{{ null_char }}') as {{ dml_data_type(col.dtype) }}) as {{ col.name }} {%-if not loop.last -%},{%- endif %}
                {% endfor %}
                FROM {{ tmp_table }}
                WHERE "$path" like '{{ full_path }}%';
        {% endset %}

        {% for query in [drop_tmp_table, create_tmp_table, drop_seed_table, create_seed_table, drop_tmp_table] %}
            {% call statement('stage', fetch_result=true) %}
                {{ query }}
            {% endcall %}
        {% endfor %}

  {% endif %}

{% endmacro %}
