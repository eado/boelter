# boelter

A mini pop quiz game for CS 33, originally created by https://github.com/eado for CS 118, updated and modified by https://github.com/burturt

## Requirements

- Docker
- Intended use ports open

## Setup

### One game

Run `docker compose up`. Players connect to ports 2222 via ssh, and the game host connects to port 2223 and can see the website at port 8080.

### Multiple games

Run `start.bash`.  
To change the number of players (default 10, max 99),
add the option `-n <num>` where `<num>` is the number of players you want to
instantiate.

This will:

- Create n + 1 Docker containers with the name `player<i>`.
  - This includes `player0` for demonstration.
  - Each will have ssh open on port `22<i:2>` (for example, `player1` has port
    `2201` open).
  - These are helpdesk servers that players use as a starting point.
- Create a progress server to track players' progression.
  - Each player connects to the progress server via WebSockets
  - The progress server pings the players whenever there's a new round
  - Based on the elapsed time, the progress server awards points when a player
    submits an answer

# Questions

All the questions are available at `player/questions.json`. The `file`
attribute points to a file in the `player/texts` directory for the actual
question text.
