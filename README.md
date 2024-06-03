# boelter

A mini pop quiz game for CS 33, originally created by https://github.com/eado for CS 118, updated and modified by https://github.com/burturt

## Requirements

- Docker
- Intended use ports open

## Setup

Make a copy of `.env.example` into `.env.`. Set a value for each:

- `JWT_TOKEN` should be some very long random secret string.
- `POSTGRES_*` self explanatory, just pick something
- `ADMIN_PASSWORD` password needed to login to the host instance. User password is just `desk`

### One game

Run `docker compose up`. Players connect to ports 2222 via ssh, and the game host connects to port 2223 and can see the website at port 8080.

### Multiple games

Run `start.bash`.  
To change the number of game instances to spawn (default 2, max 99),
add the option `-n <num>` where `<num>` is the number of players you want to
instantiate.

This will:

- Create n docker compose projects, named 01, 02, ... up to n
  - Each project consists of a psql database, a player container that players can ssh into, and a host container that the host must ssh into to start the game
  - If XX is the project name, port 2XX0 is the port players ssh into, port 2XX1 is the HTTP web server port, and port 2XX2 is the host ssh port.
  - Inside of the player container, each player gets an instance of player.js automatically upon connection
  - Each player connects to the host server via WebSockets, and directly to the database
  - The progress server pings the players whenever there's a new round
  - Based on the elapsed time, the progress server awards points when a player
    submits an answer

# Questions

All the questions are available at `player/questions.json`. The `file`
attribute points to a file in the `player/texts` directory for the actual
question text.
