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
RUN  apt-get update && apt install libcurl4-gnutls-dev -y && apt autoremove -y
COPY --from=build /app /app
WORKDIR /app
RUN ["chmod", "+x", "/app/deploy/webapp.sh"]
EXPOSE 8080
ENTRYPOINT /app/docker-entrypoint.sh