FROM --platform=linux/amd64 alpine:3

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

RUN curl -SL $ARTIFACT \
    | tar -xzC /opt \
    && mv "/opt/Mirth Connect" /opt/connect

RUN adduser -D -H -u 1000 mirth
RUN mkdir -p /opt/connect/appdata && chown -R mirth:mirth /opt/connect/appdata

VOLUME /opt/connect/appdata
VOLUME /opt/connect/custom-extensions
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
RUN --mount=type=secret,id=store_pass \
    --mount=type=secret,id=keystore_pass \
    keytool -noprompt -importkeystore -srckeystore /opt/connect/appdata/$KEYSTORENAME -srcstoretype PKCS12 \
    -srcstorepass "$(grep -v '^#' /run/secrets/keystore_pass)" -destkeystore /usr/lib/jvm/zulu17/lib/security/cacerts \
    -deststorepass "$(grep -v '^#' /run/secrets/store_pass)"  -deststoretype JKS
RUN --mount=type=secret,id=store_pass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/store_pass)" -alias sequoia1 -cacerts -file /opt/connect/appdata/sequoia1.pem
RUN --mount=type=secret,id=store_pass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/store_pass)" -alias sequoia2 -cacerts -file /opt/connect/appdata/sequoia2.pem
RUN --mount=type=secret,id=store_pass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/store_pass)" -alias sequoia3 -cacerts -file /opt/connect/appdata/sequoia3.pem
RUN --mount=type=secret,id=store_pass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/store_pass)" -alias sequoia4 -cacerts -file /opt/connect/appdata/sequoia4.pem
RUN --mount=type=secret,id=store_pass \
    keytool -noprompt  -trustcacerts -importcert \
    -storepass "$(grep -v '^#' /run/secrets/store_pass)" -alias sequoia5 -cacerts -file /opt/connect/appdata/sequoia5.pem
RUN (cat mcserver.vmoptions /opt/connect/docs/mcservice-java9+.vmoptions ; echo "") > mcserver_base.vmoptions
EXPOSE 8443

COPY entrypoint.sh /
RUN chmod 755 /entrypoint.sh
ENTRYPOINT [ "/entrypoint.sh" ]

# XML Schemas to validate incoming requests
COPY config/schemas /opt/schemas/

RUN chown -R mirth:mirth /opt/connect
USER mirth
CMD ["./mcserver"]