#########################################
### Base Image                         ##
#########################################
FROM node:18 AS build
WORKDIR /app
COPY . /app
RUN npm install --only=production --no-fund --no-optional --no-audit

#########################################
### Prod Image                         ##
#########################################
FROM node:18-slim
# TODO: #1810 remove below comment if not needed after some time - this should no longer be needed after cleaning up unused fhir converter code
# RUN  apt-get update && apt install libcurl4-gnutls-dev -y && apt autoremove -y
COPY --from=build /app /app
WORKDIR /app
# TODO: #1810 remove below comment if not needed after some time - this should no longer be needed after cleaning up unused fhir converter code
# RUN ["chmod", "+x", "/app/deploy/webapp.sh"]
EXPOSE 8080
# Use exec-form ENTRYPOINT (not 'ENTRYPOINT /app/docker-entrypoint.sh') so PID 1 is our script and signals (SIGTERM/SIGINT) reach the app reliably.
ENTRYPOINT ["/app/docker-entrypoint.sh"]