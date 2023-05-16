# Instructions for perf/load testing using locust (https://locust.io/):

#Install Locust:

Conda (https://docs.conda.io/en/latest/miniconda.html#) is recommended to manage the packages. Pip can be used to install locust.

pip install locust.io

# Run locust

Run in non-web mode with test code file, user count, hatch rate etc. params (https://docs.locust.io/en/stable/quickstart.html):

locust -f c:\src\conversion-pilot\test\perf\convert_with_predefined_template.py --host=http://localhost:2019 --no-web -c 300 -r 100 -t 1m
