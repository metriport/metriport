# set base image
# note: remove --platform flag when building on intel systems
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:18

# phase 1 - compile ts to js
# set the working directory in the container
WORKDIR /usr/src/app

# copy the dependencies file to the working directory
COPY package*.json ./
COPY tsconfig.json ./

# install dependencies
RUN npm install

# copy app source to the working directory, and compile
COPY src ./src
RUN npm run build

# phase 2 - build prod app
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:18
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --only=production
COPY --from=0 /usr/src/app/dist .

# https://docs.docker.com/engine/reference/builder/#expose
EXPOSE 8080

# command to run on container start
CMD [ "node", "app.js" ]