FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:18-alpine
ENV NODE_ENV production
WORKDIR /usr/src/app
ADD ./metriport-mllp-server.tar.gz ./
RUN npm ci --ignore-scripts --omit=dev --no-fund
###########################################################
# If you change this, you must change the NLB listeners and 
# target group ports in packages/infra/lib/hl7-notification-stack/mllp.ts
###########################################################
EXPOSE 2575 2576

ENTRYPOINT [ "node", "packages/mllp-server/dist/app.js" ]
