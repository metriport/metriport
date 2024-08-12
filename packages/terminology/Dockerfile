#########################################
### Base Image                         ##
#########################################
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . /app

#########################################
### Prod Image                         ##
#########################################
FROM node:18-slim
COPY --from=build /app /app
WORKDIR /app
EXPOSE 3000
ENTRYPOINT [ "npm", "run", "start" ]