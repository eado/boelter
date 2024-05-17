const fs = require("fs");
const blessed = require("blessed");
const ws = require("ws");

const WELCOME = fs.readFileSync("texts/boelter.txt").toString();
const INSTRUCTIONS = fs.readFileSync("texts/instructions.txt").toString();
const QUESTIONS = JSON.parse(fs.readFileSync("questions.json").toString());

const TIMELIMIT = 120;

let screen;

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

        screen.title = title;

        const titleBox = blessed.box({
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
        if (buttonLabels)
            buttonLabels.forEach((label, index) => {
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
        if (buttonLabels || istextBox) buttons[0].focus(); // Focus the first button

        // Allow pressing 'Enter' to activate the button
        screen.key(["enter"], () => {
            if (ans) {
                screen.destroy();
                res(ans);
                return;
            }
            const focused = screen.focused;
            if (focused.submit) focused.submit();
            else {
                if (focused.press) focused.press();
            }
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

function shuffle(array) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {
        // Pick a remaining element...
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex],
        ];
    }
}

async function main() {
    shuffle(QUESTIONS);

    await createTitleScreen("Boelter Library Help Desk", WELCOME, [
        "Where's Boelter 2444?",
        "How do I get to the second floor?",
    ]);
    const terms = await createTitleScreen("Instructions", INSTRUCTIONS, [
        "I agree to the terms and conditions",
        "I do not agree",
    ]);
    if (terms != "I agree to the terms and conditions") process.exit();

    createTitleScreen(
        "Please hold",
        "Please hold while we connect you to the next available representative."
    );
    const wss = new ws.WebSocket("ws://10.0.0.2:8081");
    let i = 0;
    let correct = false;
    let totalScore = 0;

    wss.on("message", async (data) => {
        screen.destroy()
        if (data == "start") {
            correct = false;
            const question = QUESTIONS[i];
            if (!question) {
              if (totalScore > 200) {
                await createTitleScreen(
                  "Thank you for your continued loyalty.",
                  "We've processed your forms and pinpointed the location of Boelter 2444. Please find it here: seasnet{b0elt3r_w45_h0n35tly_5uch_4_h0m13}",
                  ["Pass the CS 118 final"]
                );
              } else {
                await createTitleScreen(
                  "We apologize.",
                  "Sincere apologies. We could not find the location of Boelter 2444. Please try again later.",
                  ["Fail the CS 118 final"]
                );
              }
              process.exit();
            }
            i++;
            const txt = fs.readFileSync("texts/" + question.file).toString();
            const start = new Date();
            const resp = await createTitleScreen(
                question.title,
                txt,
                question.options,
                TIMELIMIT,
                question.text,
                true
            );
            const end = new Date();
            let score = Math.max(
                0,
                TIMELIMIT - Math.round((end.getTime() - start.getTime()) / 1000)
            );
            

            if (question.text) {
                if (question.correct == resp) {
                    wss.send(+score);
                    totalScore += score
                    correct = true;
                }
            } else {
                if (question.options[question.correct] == resp) {
                    wss.send(+score);
                    totalScore += score
                    correct = true;
                }
            }

            if (!correct) wss.send("0");

            createTitleScreen(
                "Received",
                "We've received your request and will get back to you shortly."
            );
        } else {
            if (correct) {
                await createTitleScreen(
                    "Your request will be processed soon.",
                    "Our staff is pleased to receive your request. At first glance, prospects are promising. Your SEASnet status has been updated accordingly.",
                    ["Thanks!", "Just give me the next form already."]
                );
            } else {
                await createTitleScreen(
                    "There was an error in your request.",
                    "There was an error processing your request. Please try again.",
                    [
                        "No way, I swear I filled everything out correctly!",
                        "Surely you must've lost my submission somewhere?",
                    ]
                );
            }
            createTitleScreen(
              "Please hold",
              "Please hold while we connect you to the next available representative."
            );
        }
    });
}

main();
