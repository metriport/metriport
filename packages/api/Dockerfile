# This is the main production Dockerfile.
# It depends on metriport-api.tar.gz which is created by deploy-api.sh
# This is a production ready image.
# It does not include any development dependencies.
# note: remove --platform flag when building on intel systems
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:18-alpine
ENV NODE_ENV production
WORKDIR /usr/src/app
ADD ./metriport-api.tar.gz ./
RUN npm ci --ignore-scripts --omit=dev --no-fund
EXPOSE 8080
ENTRYPOINT [ "node", "packages/api/dist/app.js" ]
