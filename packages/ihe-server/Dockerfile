FROM alpine:3.17
# Argument containing name and path of tar file.
ARG TARFILE
# Extract Mirth Connect tar contents to the /home/ folder
ADD ${TARFILE} /home/
COPY . /home/ihe_server
RUN chmod +x /home/ihe_server/mcserver
# Set it as the working directory
WORKDIR /home/ihe_server
# Make Mirth Connect ports available outside this container
EXPOSE 80 443 8000 8080 8100 8443 23067 16850 16852 16853
# Mount point
VOLUME /home/ihe_server/custom-lib
# To avoid Permission Denied when installing additional packages
USER root
# Java
RUN apk update && apk add openjdk11
# Might be needed for self-registration
RUN apk add ttf-dejavu
# ncurses is used by smileutil (specifically tput)
# RUN apk add --update-cache ncurses
# Midnight Commander to simplify navigation
RUN apk add mc
# Replace ash with bash
RUN apk add --update-cache bash
# Copy modified JDK settings
COPY mcserver.vmoptions ./ihe_server/mcserver.vmoptions
# Downgrade privileges
# USER <whatever>
# Start Mirth Connect

COPY entrypoint.sh /
RUN chmod 755 /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/home/ihe_server/mcserver", "run"]