FROM alpine:3

RUN apk update && apk upgrade && apk --no-cache add bash curl

ARG ARTIFACT
ARG STOREPASS
ARG KEYSTOREPASS
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
WORKDIR /opt/connect
RUN rm -rf cli-lib manager-lib \
    && rm mirth-cli-launcher.jar mirth-manager-launcher.jar mccommand mcmanager
# load truststore into JVM
COPY certs/cert1.pem /opt/connect/appdata/.
COPY certs/cert2.pem /opt/connect/appdata/.
COPY certs/cert3.pem /opt/connect/appdata/.
COPY certs/cert4.pem /opt/connect/appdata/.
COPY certs/cert5.pem /opt/connect/appdata/.
COPY certs/$KEYSTORENAME /opt/connect/appdata/.
RUN keytool -noprompt -importkeystore -srckeystore /opt/connect/appdata/$KEYSTORENAME -srcstoretype PKCS12 -srcstorepass $KEYSTOREPASS -destkeystore /usr/lib/jvm/zulu17/lib/security/cacerts -deststorepass $STOREPASS -deststoretype JKS
RUN keytool -noprompt  -trustcacerts -importcert -storepass $STOREPASS -alias cert1 -cacerts -file /opt/connect/appdata/cert1.pem
RUN keytool -noprompt  -trustcacerts -importcert -storepass $STOREPASS -alias cert2 -cacerts -file /opt/connect/appdata/cert2.pem
RUN keytool -noprompt  -trustcacerts -importcert -storepass $STOREPASS -alias cert3 -cacerts -file /opt/connect/appdata/cert3.pem
RUN keytool -noprompt  -trustcacerts -importcert -storepass $STOREPASS -alias cert4 -cacerts -file /opt/connect/appdata/cert4.pem
RUN keytool -noprompt  -trustcacerts -importcert -storepass $STOREPASS -alias cert5 -cacerts -file /opt/connect/appdata/cert5.pem
RUN (cat mcserver.vmoptions /opt/connect/docs/mcservice-java9+.vmoptions ; echo "") > mcserver_base.vmoptions
EXPOSE 8443

COPY entrypoint.sh /
RUN chmod 755 /entrypoint.sh
ENTRYPOINT [ "/entrypoint.sh" ]

RUN chown -R mirth:mirth /opt/connect
USER mirth
CMD ["./mcserver"]
