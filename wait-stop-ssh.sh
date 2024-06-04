trap 'quit=1' SIGTERM

quit=0
while [ "$quit" -ne 1 ]; do
    sleep 1
done

rc-service sshd stop