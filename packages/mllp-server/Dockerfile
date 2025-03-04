FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:18-alpine
ENV NODE_ENV production
WORKDIR /usr/src/app
ADD ./metriport-mllp-server.tar.gz ./
RUN npm ci --ignore-scripts --omit=dev --no-fund
EXPOSE 2575
ENTRYPOINT [ "node", "packages/mllp-server/dist/app.js" ]