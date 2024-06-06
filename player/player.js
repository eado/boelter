const fs = require("fs");
const blessed = require("blessed");
const ws = require("ws");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

const postgres = require("postgres");
const sql = postgres({
  host: "db",
  post: 5432,
  database: process.env["POSTGRES_DB"],
  username: process.env["POSTGRES_USER"],
  password: process.env["POSTGRES_PASSWORD"],
});

function getPromiseFromEvent(item, event) {
  return new Promise((resolve) => {
    const listener = (msg) => {
      item.removeEventListener(event, listener);
      resolve(msg);
    };
    item.addEventListener(event, listener);
  });
}

async function waitForOpenSocket(socket) {
  return new Promise((resolve) => {
    if (socket.readyState !== socket.OPEN) {
      socket.addEventListener("open", (_) => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

const SECRETTOKEN = process.env["JWT_TOKEN"] + process.env["INSTANCE_NUM"];

const WELCOME = fs.readFileSync("texts/boelter.txt").toString();
const INSTRUCTIONS = fs.readFileSync("texts/instructions.txt").toString();
const QUESTIONS = JSON.parse(fs.readFileSync("questions.json").toString());
let FORMTXT = fs.readFileSync("texts/form.txt").toString();

const TIMELIMIT = 120;

let screen;

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to create form screen
function createForm(title, text, fieldNames) {
  return new Promise((res, _) => {
    // Create a screen object
    const screen = blessed.screen({
      smartCSR: true,
      title: title ?? "Form",
    });

    // Create text description
    const titleBox = blessed.box({
      parent: screen,
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

    // Create a form
    const form = blessed.form({
      parent: screen,
      keys: true,
      left: "50%",
      top: "center",
      width: "50%",
      height: "100%",
      border: {
        type: "line",
      },
      style: {
        border: {
          fg: "#f0f0f0",
        },
      },
    });

    let fields = [];
    // Create text input fields for each field name
    fieldNames.forEach((fieldName, index) => {
      // Create a label
      blessed.text({
        parent: form,
        top: index * 2 + 1,
        left: 2,
        content: fieldName + ": ",
        style: {
          fg: "white",
        },
      });

      // Create a text input field
      const thisField = blessed.textbox({
        parent: form,
        name: fieldName,
        inputOnFocus: true,
        top: index * 2 + 1,
        left: fieldName.length + 4,
        width: 40,
        height: 1,
        style: {
          fg: "white",
        },
        vi: false,
        keys: false,
      });
      fields.push(thisField);
    });

    // Create a submit button
    const submitButton = blessed.button({
      parent: form,
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 1,
        right: 1,
      },
      left: "center",
      bottom: 1,
      name: "submit",
      content: "Submit",
      style: {
        bg: "blue",
        focus: {
          bg: "green",
        },
      },
    });

    form.focusNext();
    // fields[0].focus();

    // Handle form submission
    form.on("submit", function (data) {
      // console.log("Form data:", data);
      res(data);
      screen.destroy();
    });

    // Add a keypress event listener to the submit button to trigger form submission
    submitButton.on("press", function () {
      form.submit();
    });

    // Quit on Escape, q, or Control-C
    // screen.key(["escape", "q", "C-c"], function (ch, key) {
    //   return process.exit(0);
    // });

    // Cancel enter
    screen.key("enter", (ch, key) => {
      form.submit();
      return false;
    });

    // Render the screen
    screen.render();
  });
}

// Function to create the title screen
function createTitleScreen(
  title,
  text,
  buttonLabels,
  time = 0,
  istextBox = false,
  sure = false,
  leftalign = false,
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
      align: leftalign ? "left" : "center",
      valign: "middle",
    });

    if (!buttonLabels && !istextBox) {
      titleBox.width = "100%";
    }

    // Button configurations
    const buttons = [];

    const areYouSure = async () => {
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
      sureBox.setIndex(1000);

      // sureBox.key("escape", () => {
      //   console.log("test");
      //   ans = "";
      //   sureBox.detach();
      //   if (buttonLabels || istextBox) buttons[0].focus(); // Focus the first button
      //   screen.render();
      //   return false; // stop propagation
      // });
      screen.onceKey("escape", () => {
        // console.log("test2");
        ans = "";
        sureBox.destroy();
        if (buttonLabels || istextBox) buttons[0].focus(); // Focus the first button
        screen.render();
        return false; // stop propagation
      });
      screen.onceKey("enter", () => {
        // console.log("test3");
        if (ans) {
          screen.destroy();
          res(ans);
        }
        return false; // stop propagation
      });
      screen.focusPush(sureBox);
      screen.render();
    };

    const form = blessed.form({
      parent: screen,
      name: "form",
      top: 0,
      right: 0,
      width: "49%",
      height: "100%",
    });

    // Create buttons dynamically
    if (buttonLabels)
      buttonLabels.forEach((label, index) => {
        const button = blessed.button({
          parent: form,
          top: index * 5,
          // left: "100%",
          // width: "100%",
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
        parent: form,
        top: buttons.length * 5,
        // left: "100%",
        // width: "100%",
        height: 5,
        label: "Enter your answer: ",
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

      // Add a keypress event listener to the submit button to trigger form submission
      textBox.on("submit", (text) => {
        if (sure) {
          ans = text;
          areYouSure();
        } else {
          screen.destroy();
          res(text);
        }
      });

      // Stop users from exiting screen
      // textBox.key('escape', (ch, key) => {
      //   console.log("escape textbox");
      //   // Prevent the default behavior of the escape key.
      //   textBox.focus();
      // });

      // textBox.on("blur", (event) => {
      //   event.
      // })
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
      // console.log("enter detected");
      if (ans) {
        screen.destroy();
        res(ans);
        return;
      }
      const focused = screen.focused;
      if (focused.submit) {
        // console.log("submit", focused.submit.toString());
        focused.submit();
      } else if (focused.press) {
        // console.log("press");
        focused.press();
      }
    });

    // Allow using arrow keys to switch between buttons
    screen.key(["up", "down", "left", "right"], (ch, key) => {
      let focusedIndex = buttons.indexOf(screen.focused);
      if (key.name === "up" || key.name === "left") {
        focusedIndex = (focusedIndex - 1 + buttons.length) % buttons.length;
      } else if (key.name === "down" || key.name === "right") {
        focusedIndex = (focusedIndex + 1) % buttons.length;
      }

      const toFocus = buttons[focusedIndex];
      if (toFocus !== undefined) {
        toFocus.focus();
      }
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
  const wss = new ws.WebSocket("ws://server:8081");
  wss.on("error", () => {
    try {
      screen.destroy();
    } finally {
      console.log(
        "An error occurred when connecting to the game. Is the game running?",
      );
      process.exit(1);
    }
  });
  await waitForOpenSocket(wss);
  await sql`select * from teams;`;
  const valForm = function (names) {
    // If any part of member3 is filled out, all 3 must be filled out
    let emptyVals = 0;
    for (key in names) {
      if (key.includes("Member #3")) {
        emptyVals += names[key] == "";
      }
    }
    if (emptyVals !== 3 && emptyVals !== 0) {
      return "Member #3 Partially filled out";
    }

    for (key in names) {
      // console.log(key);
      if (
        key.toString().includes("optional") ||
        key.toString().includes("submit")
      ) {
        continue;
      }
      if (key.toString().includes("UID")) {
        if (!names[key].match(/^[0-9]{9}$/)) {
          return "UID invalid - should be exactly 9 digits";
        }
      }
      `1`;
      if (key.toString().includes("Discussion")) {
        if (!names[key].match(/^[a-gA-G]$/)) {
          return "Invalid discussion - should be a single character A-G";
        }
        names[key] = names[key].toUpperCase();
      }
    }
    return false;
  };

  // shuffle(QUESTIONS);

  let teamName;
  let ts;

  const rejoinRes = await createTitleScreen(
    "Player create",
    "Do you already have a ticket that you would like to rejoin the queue for?",
    ["No, I'm new", "Yes - I have a rejoin token"],
  );

  if (rejoinRes.startsWith("Yes")) {
    const inputToken = await createTitleScreen(
      "Login verification",
      "Please enter your team rejoin token:",
      [],
      0,
      true,
    );
    try {
      teamName = jwt.verify(inputToken, SECRETTOKEN)["t"];
      ts = jwt.verify(inputToken, SECRETTOKEN)["iat"];
    } catch {
      screen.destroy();
      console.log("Invalid team token");
      process.exit(1);
    }

    let msg = getPromiseFromEvent(wss, "message");
    wss.send(`rejoin ${teamName} ${ts}`);
    //console.log("a");
    msg = await (await msg).data;
    //console.log("msg:", msg);
    msg = msg.toString();
    if (msg === "team_rejoin_success") {
      console.log(
        "Team token (can be used to reconnect if disconnected):",
        jwt.sign({ k: 0, t: teamName }, SECRETTOKEN),
      );
    } else if (msg === "team_does_not_exist") {
      screen.destroy();
      console.log("Your team was not found. Did a new game start?");
      process.exit(1);
    }
  } else {
    await createTitleScreen("Boelter Library Help Desk", WELCOME, [
      "Where's Boelter 2444?",
      "How do I get to the second floor?",
    ]);
    const terms = await createTitleScreen("Instructions", INSTRUCTIONS, [
      "I agree to the terms and conditions",
      "I do not agree",
    ]);
    if (terms != "I agree to the terms and conditions") process.exit();

    // Collect information

    let names = await createForm("Data collection", FORMTXT, [
      "Member #1 Name",
      "Member #1 UID",
      "Member #1 Discussion",
      "Member #2 Name",
      "Member #2 UID",
      "Member #2 Discussion",
      "Member #3 Name (optional)",
      "Member #3 UID (optional)",
      "Member #3 Discussion (optional)",
    ]);

    while (true) {
      let err = valForm(names);
      if (err === false) {
        break;
      }
      names = await createForm(
        "Data collection",
        FORMTXT.replace(
          "\n                    \n",
          `\n{red-bg}Error: ${err}{/red-bg}\n\n`,
        ),
        [
          "Member #1 Name",
          "Member #1 UID",
          "Member #1 Discussion",
          "Member #2 Name",
          "Member #2 UID",
          "Member #2 Discussion",
          "Member #3 Name (optional)",
          "Member #3 UID (optional)",
          "Member #3 Discussion (optional)",
        ],
      );
    }

    console.log(
      "Proof of submission: ",
      jwt.sign({ k: 1, d: names }, SECRETTOKEN),
    );

    await timeout(100);

    teamName = await createTitleScreen(
      "Preferred Name",
      "What is your preferred name your group would like to be referred to as?\n\nMust be appropriate, and will be displayed when your responses are used in statistical reports in place of your legal name.",
      undefined,
      null,
      true,
      true,
    );

    const invalidTeamNameScreen = async function (e) {
      return await createTitleScreen(
        "Preferred Name",
        `{red-bg}Error: ${e}{/red-bg}\n\nWhat is your preferred name your group would like to be referred to as?\n\nMust be appropriate, and will be displayed when your responses are used in statistical reports in place of your legal name.`,
        undefined,
        0,
        true,
        true,
      );
    };

    let validTeam = false;

    // const checkIfTaken = (msg) => {
    //   if (msg === "team_taken") {
    //     validTeam = false;
    //   } else if (msg === "team_create_success") {
    //     validTeam = true;
    //   }
    // }

    while (!validTeam) {
      teamName = teamName.toString().trim();
      //console.log("Name:", teamName);
      //console.log("Length:", teamName.length);

      if (teamName.length < 4 || teamName.length > 20) {
        teamName = await invalidTeamNameScreen(
          "Preferred names must be between 4 and 20 characters.",
        );

        continue;
      }
      if (!teamName.match(/^[a-zA-Z0-9 ]+$/)) {
        teamName = await invalidTeamNameScreen(
          "Preferred names must only contain alphanumeric characters and spaces.",
        );
        continue;
      }
      if (
        (await sql`select * from teams where team_name = ${teamName}`).length >
        0
      ) {
        teamName = await invalidTeamNameScreen(
          "Your preferred name was already taken in our system. Please use another preferred name.",
        );
        continue;
      }
      console.log(
        "Connecting - if you see this message for more than a few seconds, the connection failed.",
      );
      let msg = getPromiseFromEvent(wss, "message");
      wss.send(`create ${teamName}`);
      //console.log("a");
      msg = await (await msg).data;
      //console.log("msg:", msg);
      msg = msg.toString();
      if (msg == "team_create_success") {
        console.log(
          "\n\n\n\n\n\nTeam token (can be used to reconnect if disconnected):",
          jwt.sign({ k: 0, t: teamName }, SECRETTOKEN),
          "\n\n\n\n\n\n\n",
        );
        break;
      } else {
        teamName = await invalidTeamNameScreen(
          "Your preferred name was already taken in our system. Please use another preferred name.",
        );
        continue;
      }
    }

    // create in db
    await sql`insert into teams (
          team_name, member1_name, member2_name, member1_id, member2_id, member1_dis, member2_dis
        ) values (
          ${teamName}, ${names["Member #1 Name"]}, ${names["Member #2 Name"]},
          ${names["Member #1 UID"]}, ${names["Member #2 UID"]},
          ${names["Member #1 Discussion"]}, ${names["Member #2 Discussion"]}
        )`;

    if (names["Member #3 Name"]) {
      await sql`update teams set member3_name = ${names["Member #3 Name"]}, member3_id = ${names["Member #3 UID"]}, member3_dis = ${names["Member #3 Discussion"]} where team_name = ${teamName}`;
    }
  }

  let correct = false;
  let totalScore = 0;

  if (rejoinRes.startsWith("Yes")) {
    totalScore = parseInt(
      (
        await sql`select sum(points) as pts from submissions where team_name = ${teamName}`
      )[0]["pts"],
    );
  }

  createTitleScreen(
    "Please hold",
    "Please hold while we connect you to the next available representative.",
  );

  wss.on("message", async (data) => {
    data = data.toString();
    let msgType;
    let content;
    if (data.includes(" ")) {
      msgType = data.substring(0, data.indexOf(" ")).trim();
      content = data.substring(data.indexOf(" ") + 1).trim();
    } else {
      msgType = data;
      content = null;
    }
    screen.destroy();
    if (msgType == "start") {
      correct = false;
      const question = QUESTIONS[Number(content)];
      const txt = fs.readFileSync("texts/" + question.file).toString();
      const start = new Date();
      const resp = await createTitleScreen(
        question.title,
        txt,
        question.options,
        question.time,
        question.text,
        true,
        true,
      );
      const end = new Date();
      let score = Math.max(
        question.time,
        question.time +
          question.time -
          Math.round((end.getTime() - start.getTime()) / 1000),
      );

      if (question.text) {
        const re = new RegExp("^" + question.correct + "$");
        if (re.test(resp.trim())) {
          totalScore += score;
          correct = true;
        }
      } else {
        if (question.options[question.correct] == resp) {
          totalScore += score;
          correct = true;
        }
      }

      if (correct) {
        await sql`insert into submissions (team_name, question, points, solved) values 
        (${teamName}, ${Number(content)}, ${score}, TRUE)`;
        wss.send(`answer ${+score}`);
      } else {
        await sql`insert into submissions (team_name, question, points, solved) values 
        (${teamName}, ${Number(content)}, 0, FALSE)`;
        wss.send("answer 0");
      }

      createTitleScreen(
        "Received",
        "We've received your request and will get back to you shortly.",
      );
    } else if (msgType === "end") {
      if (correct) {
        await createTitleScreen(
          "Your request will be processed soon.",
          `Our staff is pleased to receive your request. At first glance, prospects are promising. Your SEASnet support ticket has been updated accordingly to priority ${totalScore}.`,
          ["Thanks!", "Just give me the next form already."],
        );
      } else {
        await createTitleScreen(
          "There was an error in your request.",
          `There was an error processing your request. Please try again. Your SEASnet support ticket priority is still ${totalScore}`,
          [
            "No way, I swear I filled everything out correctly!",
            "Surely you must've lost my submission somewhere?",
          ],
        );
      }
      createTitleScreen(
        "Please hold",
        "Please hold while we connect you to the next available representative.",
      );
    } else if (msgType === "finish") {
      if (totalScore > 200) {
        await createTitleScreen(
          "Thank you for your continued loyalty.",
          `We've processed your forms and pinpointed the location of Boelter 2444.\n\nFinal ticket priority level: ${totalScore}`,
          ["Pass the CS 33 final!"],
        );
      } else {
        await createTitleScreen(
          "We apologize.",
          `Sincere apologies. We could not find the location of Boelter 2444. Please try again later.\n\nFinal ticket priority level: ${totalScore}`,
          ["Fail the CS 33 final"],
        );
      }
      process.exit();
    } else if (msgType === "pong") {
      // Do nothing
    }
  });
}

main();
