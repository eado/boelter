FROM alpine:3.19

ENV USER=host
ARG ADMIN_PASSWORD
ENV ADMIN_PASSWORD $ADMIN_PASSWORD
ENV ENV=/$USER/.rc

WORKDIR /$USER

STOPSIGNAL SIGKILL

RUN mkdir -p /$USER \
    && echo -e "$ADMIN_PASSWORD\n$ADMIN_PASSWORD\n" | adduser --gecos "" --home "/$USER" --no-create-home $USER \
    && mkdir -p /$USER/.ssh \
    && chmod 0700 /$USER/.ssh \
    && apk add openrc openssh \
    && ssh-keygen -A \
    && mkdir -p /run/openrc \
    && touch /run/openrc/softlevel \
    && echo -e "" > /etc/motd \
    && apk add --update bind-tools \
    && apk add --update nodejs npm \
    && echo -e "trap 'exit' 0 SIGINT EXIT SIGSTOP \n/$USER/run \nexit" >> /etc/profile 

COPY progress/ .
COPY .env .
COPY questions/questions.json .
RUN npm i

CMD ["sh", "-c", "rc-status; rc-service sshd start; tail -f /dev/null"]
