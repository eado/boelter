const fs = require("fs");
const blessed = require("blessed");
const ws = require("ws");
const jwt = require("jsonwebtoken");

function getPromiseFromEvent(item, event) {
  return new Promise((resolve) => {
    const listener = (msg) => {
      item.removeEventListener(event, listener);
      resolve(msg);
    }
    item.addEventListener(event, listener);
  })
}


async function  waitForOpenSocket(socket) {
  return new Promise((resolve) => {
    if (socket.readyState !== socket.OPEN) {
      socket.addEventListener("open", (_) => {
        resolve();
      })
    } else {
      resolve();
    }
  });
}

const SECRETTOKEN =
  "3tefU4UvEdNSMpZLcEab5nBQDZ8CbU7M9LzvRwSYP6WaBBixtYp9GRdzzjxWjp6k";

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
      bg: "black",
      border: {
        type: "line",
      },
      style: {
        border: {
          fg: "blue",
        },
      }
    });


    let fields = [];
    // Create text input fields for each field name
    fieldNames.forEach((fieldName, index) => {
      // Create a label
      blessed.text({
        parent: form,
        top: index * 3 + 1,
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
        top: index * 3 + 1,
        left: fieldName.length + 4,
        width: 40,
        height: 1,
        bg: "white",
        style: {
          fg: "black",
        },
        vi: false,
        keys: false
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
      console.log("Form data:", data);
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
    })

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
          "Is this your final answer? Press enter to submit and q to go back (you might have to hit twice).",
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
      name: 'form',
      top: 0,
      right: 0,
      width: "49%",
      height: "100%"
    })

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
      } 
      else if (focused.press) {
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

  const valForm = function (names) {
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
          return false;
        }
      }
    }
    return true;
  };

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

  // Collect information

  let names;

  do {
    names = await createForm("Data collection", FORMTXT, [
      "Member #1 Name",
      "Member #1 UID",
      "Member #2 Name",
      "Member #2 UID",
      "Member #3 Name (optional)",
      "Member #3 UID (optional)",
    ]);
    FORMTXT = FORMTXT.replace(
      "\n                    \n",
      "\nError: Invalid form. Make sure UIDs are exactly 9 digits, and your name is filled out!\n",
    );
  } while (!valForm(names));

  // console.log("Proof of submission: ", jwt.sign({details: names, t: Date.now() }, SECRETTOKEN))

  await timeout(100);

  let teamName = await createTitleScreen(
    "Preferred Name",
    "What is your preferred name your group would like to be referred to as?\n\nMust be appropriate, and will be displayed when your responses are used in statistical reports in place of your legal name.",
    undefined,
    null,
    true,
    true
  );



  const invalidTeamNameScreen = async function(e) {
    return await createTitleScreen(
      "Preferred Name",
      `Error: ${e}\n\nWhat is your preferred name your group would like to be referred to as?\n\nMust be appropriate, and will be displayed when your responses are used in statistical reports in place of your legal name.`,
      undefined, 0, true, true
    );
  }
  const wss = new ws.WebSocket("ws://localhost:8081");
  await waitForOpenSocket(wss);
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
    console.log("Name:", teamName);
    console.log("Length:", teamName.length);

    if (teamName.length < 4 || teamName.length > 20) {
      teamName = await invalidTeamNameScreen("Preferred names must be between 4 and 20 characters.");

      continue;
    }
    if (!teamName.match(/^[a-zA-Z0-9]+$/)) {
      teamName = await invalidTeamNameScreen("Preferred names must only contain alphanumeric characters and spaces.");
      continue;
    }
    console.log("Connecting");
    let msg = getPromiseFromEvent(wss, "message");
    wss.send(`create ${teamName}`);
    console.log("a");
    msg = await (await msg).data
    console.log("msg:", msg);

    msg = msg.toString();
    await timeout(1000);

    if (msg == "team_create_success") {
      break;
    } else {
      teamName = await invalidTeamNameScreen("Your preferred name was already taken in our system. Please use another preferred name.");
      continue;
    }
  }


  let i = 0;
  let correct = false;
  let totalScore = 0;

  createTitleScreen(
    "Please hold",
    "Please hold while we connect you to the next available representative.",
  );

  wss.on("message", async (data) => {
    if ("data" === "team_taken") {

    }
    screen.destroy();
    if (data == "start") {
      correct = false;
      const question = QUESTIONS[i];
      if (!question) {
        if (totalScore > 200) {
          await createTitleScreen(
            "Thank you for your continued loyalty.",
            "We've processed your forms and pinpointed the location of Boelter 2444. Please find it here: seasnet{b0elt3r_w45_h0n35tly_5uch_4_h0m13}",
            ["Pass the CS 33 final"],
          );
        } else {
          await createTitleScreen(
            "We apologize.",
            "Sincere apologies. We could not find the location of Boelter 2444. Please try again later.",
            ["Fail the CS 33 final"],
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
        true,
      );
      const end = new Date();
      let score = Math.max(
        0,
        TIMELIMIT - Math.round((end.getTime() - start.getTime()) / 1000),
      );

      if (question.text) {
        if (question.correct == resp) {
          wss.send(`answer ${+score}`);
          totalScore += score;
          correct = true;
        }
      } else {
        if (question.options[question.correct] == resp) {
          wss.send(`answer ${+score}`);
          totalScore += score;
          correct = true;
        }
      }

      if (!correct) wss.send("answer 0");

      createTitleScreen(
        "Received",
        "We've received your request and will get back to you shortly.",
      );
    } else {
      if (correct) {
        await createTitleScreen(
          "Your request will be processed soon.",
          "Our staff is pleased to receive your request. At first glance, prospects are promising. Your SEASnet status has been updated accordingly.",
          ["Thanks!", "Just give me the next form already."],
        );
      } else {
        await createTitleScreen(
          "There was an error in your request.",
          "There was an error processing your request. Please try again.",
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
    }
  });
}

main();
