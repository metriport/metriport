#########################################
### Base Image                         ##
#########################################
FROM node:18 AS build
WORKDIR /app
COPY . /app
RUN npm ci --no-fund --no-audit

#########################################
### Prod Image                         ##
#########################################
FROM node:18-slim
COPY --from=build /app /app
WORKDIR /app
EXPOSE 8443
EXPOSE 8080
EXPOSE 8081
EXPOSE 8082
EXPOSE 8083
EXPOSE 8084
EXPOSE 8085
EXPOSE 8086
EXPOSE 9091
EXPOSE 9092
ENTRYPOINT npm start
