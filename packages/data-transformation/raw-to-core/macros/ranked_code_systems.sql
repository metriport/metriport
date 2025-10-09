{% macro immunization_code_system() %}
    case 
        when system = 'cvx' then 0
        when system = 'snomed-ct' then 1
        else 2
    end
{% endmacro %}

{% macro observation_code_system() %}
    case 
        when system = 'loinc' then 0
        when system = 'snomed-ct' then 1
        when system = 'cpt' then 2
        when system = 'actcode' then  3
        else 4
    end
{% endmacro %}

{% macro condition_code_system() %}
    case 
        when system = 'icd-10-cm' then 0
        when system = 'snomed-ct' then 1
        when system = 'icd-9-cm' then 2
        when system = 'loinc' then 3
        else 4 
    end 
{% endmacro %}

{% macro procedure_code_system() %}
    case 
        when system = 'cpt' then 0
        when system = 'loinc' then 1
        when system = 'snomed-ct' then 2
        when system = 'cdt' then 3
        when system = 'hcpcs' then 4
        else 5
    end
{% endmacro %}

{% macro encounter_code_system() %}
    case 
        when system = 'actcode' then 0
        when system = 'cpt' then 1
        else 2
    end
{% endmacro %}
