import blessed from 'blessed';
import { WebSocketServer } from "ws";
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const NUMQUESTIONS = 8;

const wss = new WebSocketServer({ host: '0.0.0.0', port: 8081 });
const server = express();

const players = {};
let message = "";

server.get('/', (_, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    res.sendFile(path.join(__dirname, '/index.html'));
});

server.get('/progress', (_, res) => {
    if (message) { res.send({message}); return; }
    const progress = {}
    for (let player in players) {
        if (players[player].alive) {
            progress[player] = players[player].score
        }
    }

    res.send(progress);
});

server.listen(8080);

let screen;
let titleBox;

let ROOMS = ['CLICC Lending', 'Front Desk', 'Backrooms', 'Lounge']
let QUESTIONS = 12

/* STATES */
const START = 0;
const ANSWER = 1;
const JUDGE = 2;
const WAIT = 3;

let currentState = START;

// Function to create the title screen
function createTitleScreen(
    title,
    text,
    buttonLabels,
    time = 0,
    istextBox = false,
    sure = false
) {
    return new Promise((res, _) => {
        let ans = "";
        // Create a screen object.
        screen = blessed.screen({
            smartCSR: true,
        });
        // Add a way to quit the program
        screen.key(["C-c"], (ch, key) => {
            return process.exit(0);
        });
        screen.title = title;

        titleBox = blessed.box({
            top: "center",
            left: "left",
            width: "49%",
            height: "100%",
            content: text,
            tags: true,
            border: {
                type: "line",
            },
            style: {
                fg: "white",
                bg: "blue",
                border: {
                    fg: "#f0f0f0",
                },
            },
            align: "center",
            valign: "middle",
        });

        // Button configurations
        const buttons = [];

        const areYouSure = () => {
            const sureBox = blessed.box({
                parent: screen,
                top: "center",
                left: "center",
                width: "25%",
                height: "25%",
                content:
                    "Is this your final answer? Press enter to submit and escape to go back.",
                tags: true,
                border: {
                    type: "line",
                },
                style: {
                    fg: "white",
                    bg: "blue",
                    border: {
                        fg: "#f0f0f0",
                    },
                },
                align: "center",
                valign: "middle",
            });

            screen.key("escape", () => {
                ans = "";
                sureBox.detach();
                screen.render();
            });
            sureBox.focus();
        };

        // Create buttons dynamically
        if (buttonLabels) buttonLabels.forEach((label, index) => {
            const button = blessed.button({
                parent: titleBox,
                top: index * 5,
                left: "100%",
                width: "100%",
                height: 5,
                content: label,
                align: "center",
                valign: "middle",
                tags: true,
                border: {
                    type: "line",
                },
                style: {
                    fg: "white",
                    focus: {
                        bg: "blue",
                    },
                },
            });

            // Handle button press
            button.on("press", () => {
                if (sure) {
                    ans = label;
                    areYouSure();
                } else {
                    screen.destroy();
                    res(label);
                }
            });

            buttons.push(button);
        });

        if (istextBox) {
            const textBox = blessed.textbox({
                parent: titleBox,
                top: buttons.length * 5,
                left: "100%",
                width: "100%",
                height: 5,
                label: "Enter your answer (press escape to exit text box): ",
                border: {
                    type: "line",
                },
                style: {
                    fg: "white",
                    focus: {
                        bg: "blue",
                    },
                },
                inputOnFocus: true,
            });

            buttons.push(textBox);

            textBox.on("submit", (text) => {
                if (sure) {
                    ans = text;
                    areYouSure();
                } else {
                    screen.destroy();
                    res(text);
                }
            });
        }

        if (time) {
            const timeToText = () => {
                const min =
                    Math.floor(time / 60) < 10
                        ? "0" + Math.floor(time / 60)
                        : +Math.floor(time / 60);
                const sec = time % 60 < 10 ? "0" + (time % 60) : +(time % 60);
                return min + ":" + sec;
            };

            const timerBox = blessed.box({
                parent: titleBox,
                top: "top",
                left: "left",
                width: 20,
                height: 5,
                content: timeToText(),
                tags: true,
                border: {
                    type: "line",
                },
                style: {
                    fg: "white",
                    border: {
                        fg: "#f0f0f0",
                    },
                },
                align: "center",
                valign: "middle",
            });

            const int = setInterval(() => {
                if (time == 0) {
                    clearInterval(int);
                    return;
                }
                time -= 1;
                timerBox.content = timeToText();
                if (time < 20 && time % 2 == 0) timerBox.style.bg = "red";
                else timerBox.style.bg = "";
                screen.render();
            }, 1000);
        }

        screen.append(titleBox);
        if (buttonLabels) buttons[0].focus(); // Focus the first button

        // Allow pressing 'Enter' to activate the button
        screen.key(["enter"], () => {
            if (ans) {
                screen.destroy();
                res(ans);
                return;
            }
            const focused = screen.focused;
            if (focused.submit) focused.submit()
            else focused.press();
        });

        // Allow using arrow keys to switch between buttons
        screen.key(["up", "down", "left", "right"], (ch, key) => {
            let focusedIndex = buttons.indexOf(screen.focused);
            if (key.name === "up" || key.name === "left") {
                focusedIndex =
                    (focusedIndex - 1 + buttons.length) % buttons.length;
            } else if (key.name === "down" || key.name === "right") {
                focusedIndex = (focusedIndex + 1) % buttons.length;
            }
            buttons[focusedIndex].focus();
            screen.render();
        });

        screen.render();
    });
}

wss.on("connection", function connection(ws, req) {
    const addr = req.socket.remoteAddress + req.socket.remotePort;
    if (Object.keys(players).indexOf(addr) < 0 && currentState == START) {
        titleBox.content += addr + ", ";
        screen.render()
    }
    titleBox.content += (req.socket.remotePort % 4) == 0
    screen.render()
    players[addr] = {
        socket: ws,
        room: "",
        question: -1,
        score: 0,
        impostor: (req.socket.remotePort % 4) == 0,
        alive: true
    };

    ws.on("message", function message(data) {
        if (state == ANSWER) {
            const isCorrect = Boolean(Number(data.toString()))
            
        }
    });


});



async function main() {
    await createTitleScreen('', 'Waiting for players...\n', ['Start Game'], 0, false, true);

    for (let player in players) {
        players[player].socket.send("ROLE: " + (players[player].impostor ? "impostor" : "player"));
    }

    while (true) {
        currentState = ANSWER;
        let numAlive = 0;
        let numImpostors = 0;
        for (let player in players) {
            if (players[player].alive) numAlive += 1;
            if (players[player].impostor && players[player].alive) numImpostors += 1;
        }

        if (numAlive == numImpostors) {
            message = "Impostors won...";
            wss.clients.forEach(ws => ws.send("END: impostors"));
            await createTitleScreen('', 'Impostors won...\n', ['End Game'], 0, false, false);
            process.exit()
        } else if (numImpostors == 0) {
            message = "Players win...";
            wss.clients.forEach(ws => ws.send("END: players"));
            await createTitleScreen('', 'Players win...\n', ['End Game'], 0, false, false);
            process.exit()
        }

        const roomLens = {}
        for (let player in players) {
            const idx = Math.floor(Math.random() * ROOMS.length)
            if (!players[player].impostor) {
                if (idx in roomLens) roomLens[idx]++
                else roomLens[idx] = 1
            }
            players[player].room = ROOMS[idx]
        }
        
        const roomQs = []
        for (let i in ROOMS) {
            const qs = [];
            for (let j = 0; j < roomLens[i]; j++) {
                while (true) {
                    let q = Math.floor(Math.random() * QUESTIONS)
                    if (qs.indexOf(q) < 0) {
                        qs.push(q);
                        break;
                    }
                }
            }
            roomQs.push(qs)
        }

        let content = "Current round:\n";
        for (let player in players) {
            const idx = ROOMS.indexOf(players[player].room)
            if (players[player].impostor) {
                if (!roomLens[idx]) {
                    players[player].question = Math.floor(Math.random() * QUESTIONS) 
                } else {
                    players[player].question = roomQs[idx][Math.floor(Math.random() * roomLens[idx])];
                }
            }
            else
                players[player].question = roomQs[idx][--roomLens[idx]];
            content += `${player}: At: ${players[player].room}, Q: ${players[player].question}\n`
            players[player].socket.send(`ROOM: ${players[player].room}, QUESTION: ${players[player].question}`)
        }

        await createTitleScreen('', content, ['End Round'], 120, false, true);
        wss.clients.forEach(ws => ws.send("ROUND: end"));


    }
}

main()
