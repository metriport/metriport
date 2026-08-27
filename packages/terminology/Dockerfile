#########################################
### Build Image                        ##
#########################################
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install
COPY src ./src
RUN npm run build

#########################################
### Prod Image                         ##
#########################################
FROM node:18-slim
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8080
ENTRYPOINT [ "node", "dist/app.js" ]