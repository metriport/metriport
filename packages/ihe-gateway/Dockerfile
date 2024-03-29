ARG PLATFORM=linux/amd64
FROM --platform=$PLATFORM alpine:3

RUN apk update && apk upgrade && apk --no-cache add bash curl

ARG ARTIFACT
ARG KEYSTORENAME
ARG ZULUKEY

ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

ARG ZULU_KEY_SHA256=$ZULUKEY
RUN wget --quiet https://cdn.azul.com/public_keys/alpine-signing@azul.com-5d5dc44c.rsa.pub -P /etc/apk/keys/ && \
    echo "${ZULU_KEY_SHA256}  /etc/apk/keys/alpine-signing@azul.com-5d5dc44c.rsa.pub" | sha256sum -c - && \
    apk --repository https://repos.azul.com/zulu/alpine --no-cache add zulu17-jre~=17.0.7 tzdata

ENV JAVA_HOME=/usr/lib/jvm/zulu17

# TODO try this out: FROM nextgenhealthcare/connect:4.4.2
RUN curl -SL $ARTIFACT \
    | tar -xzC /opt \
    && mv "/opt/Mirth Connect" /opt/connect

RUN adduser -D -H -u 1000 mirth
RUN mkdir -p /opt/connect/appdata && chown -R mirth:mirth /opt/connect/appdata

# initialization scripts and configs
COPY scripts /opt/connect/scripts
COPY server /opt/connect/server
COPY config/custom-libs/aws/*.jar /opt/connect/server-lib/aws
COPY config/custom-extensions /opt/connect/custom-extensions
VOLUME /opt/connect/appdata
VOLUME /opt/connect/custom-lib

WORKDIR /opt/connect
RUN rm -rf cli-lib manager-lib \
    && rm mirth-cli-launcher.jar mirth-manager-launcher.jar mccommand mcmanager
# load truststore into JVM
COPY config/certs/sequoia1.pem /opt/connect/appdata/.
COPY config/certs/sequoia2.pem /opt/connect/appdata/.
COPY config/certs/sequoia3.pem /opt/connect/appdata/.
COPY config/certs/sequoia4.pem /opt/connect/appdata/.
COPY config/certs/sequoia5.pem /opt/connect/appdata/.
COPY config/certs/$KEYSTORENAME /opt/connect/appdata/.
RUN --mount=type=secret,id=keystore_storepass \
    --mount=type=secret,id=keystore_keypass \
    keytool -noprompt -importkeystore -srckeystore /opt/connect/appdata/$KEYSTORENAME -srcstoretype PKCS12 \
    -srcstorepass "$(grep -v '^#' /run/secrets/keystore_keypass)" -destkeystore /usr/lib/jvm/zulu17/lib/security/cacerts \
    -deststorepass "$(grep -v '^#' /run/secrets/keystore_storepass)"  -deststoretype JKS
RUN --mount=type=secret,id=keystore_storepass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/keystore_storepass)" -alias sequoia1 -cacerts -file /opt/connect/appdata/sequoia1.pem
RUN --mount=type=secret,id=keystore_storepass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/keystore_storepass)" -alias sequoia2 -cacerts -file /opt/connect/appdata/sequoia2.pem
RUN --mount=type=secret,id=keystore_storepass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/keystore_storepass)" -alias sequoia3 -cacerts -file /opt/connect/appdata/sequoia3.pem
RUN --mount=type=secret,id=keystore_storepass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/keystore_storepass)" -alias sequoia4 -cacerts -file /opt/connect/appdata/sequoia4.pem
RUN --mount=type=secret,id=keystore_storepass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/keystore_storepass)" -alias sequoia5 -cacerts -file /opt/connect/appdata/sequoia5.pem
RUN (cat mcserver.vmoptions /opt/connect/docs/mcservice-java9+.vmoptions ; echo "") > mcserver_base.vmoptions
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
EXPOSE 9093

COPY entrypoint.sh /
RUN chmod 755 /entrypoint.sh
ENTRYPOINT [ "/entrypoint.sh" ]

# XML Schemas to validate incoming requests
COPY config/schemas /opt/schemas/

RUN chown -R mirth:mirth /opt/connect
USER mirth
CMD ["./mcserver"]