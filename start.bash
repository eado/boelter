#!/bin/bash

# Get number of game instances
n=2

if [ $# -eq 1 ]; then
    n=$1
elif [ $# -gt 1 ]; then
    echo "Usage: $0 [n]"
    echo "Where n is the optional number of player containers to start. Default is 2. Max is 99."
    exit 1
fi

# Remove everything
docker stop `docker ps -qa`
docker rm `docker ps -qa`

# Start networks w/ compose under different project names
for i in $(seq 1 $n); do
    suffix=$(printf "%02d" $i)
    export SERVER_PORT=2${suffix}2
    export SERVER_HTTP_PORT=2${suffix}1
    export PLAYER_PORT=2${suffix}0
    export INSTANCE_NUM=$suffix
    docker compose -p ${suffix} up --build -d 
done

echo Done! Each game instance is started at port 2XXY, where XX is the 2-digit game instance number starting at 01, and Y is 0 for player ssh join, 1 for http web server, and 2 for host ssh join.