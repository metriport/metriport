FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:18-alpine
ENV NODE_ENV production
WORKDIR /usr/src/app
ADD ./metriport-mllp-server.tar.gz ./
RUN npm ci --ignore-scripts --omit=dev --no-fund

###########################################################
# IF YOU CHANGE THIS, YOU MUST CHANGE THE NLB LISTENERS AND 
# TARGET GROUP PORTS IN INFRA/LIB/HL7-NOTIFICATION-STACK/MLLP.TS
###########################################################
EXPOSE 2575-2584

ENTRYPOINT [ "node", "packages/mllp-server/dist/app.js" ]