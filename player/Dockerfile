FROM alpine:3.19

ENV USER=help
ENV PASSWORD=desk
ENV ENV=/$USER/.rc

WORKDIR /$USER

RUN mkdir -p /$USER \
    && echo -e "$PASSWORD\n$PASSWORD\n" | adduser --gecos "" --home "/$USER" --no-create-home $USER \
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

COPY player/ .
RUN npm i
COPY .env .
COPY questions/questions.json .
COPY wait-stop-ssh.sh .
RUN chmod +x wait-stop-ssh.sh

CMD ["sh", "-c", "echo ' ' >> .env; echo INSTANCE_NUM=$INSTANCE_NUM >> .env; rc-status; rc-service sshd start; ./wait-stop-ssh.sh"]
