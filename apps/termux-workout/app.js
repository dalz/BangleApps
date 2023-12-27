let Layout = require("Layout");
let sched = require("sched");
let buzz = require("buzz");

Bangle.loadWidgets();

let Storage = require('Storage');

var settings = Object.assign({
  rest_time_secs: 120,
}, Storage.readJSON("termux-workout.json", true) || {});

let exs = Storage.readJSON("termux-workout.exs.json", true) || [];
exs.forEach(ex => ex.sets = []);

delete Storage;

let exs_per_page = 4;
let num_pages = Math.ceil(exs.length / exs_per_page);
let cur_page = 0;

let cur_mode = 0; // 0: exs list, 1: rep counter

Bangle.on('swipe', (lr, _ud) => {
  if (cur_mode != 0)
    return;
  cur_page = E.clip(cur_page - lr, 0, num_pages - 1);
  selectEx();
});

function selectEx() {
  cur_mode = 0;

  let btn_watch_id;

  let l = {type: "v", c: []};

  function exToBtn(i) {
    return exs[i] ?
      {type: "btn", label: exs[i].short,
       width: g.getWidth() / 2, fillx: 1, filly: 1,
       cb: l => {
         clearWatch(btn_watch_id);
         registerReps(i);
       }}
    : {};
  }

  for (let i = 0; i < exs_per_page; i += 2) {
    let j = i + cur_page * exs_per_page;
    l.c.push({
      type: "h",
      c: [exToBtn(j), exToBtn(j + 1)],
    });
  }

  let exs_layout = new Layout(l, {back: confirmQuit});

  g.clear();
  Bangle.drawWidgets();
  exs_layout.render();

  btn_watch_id = setWatch(writeLogAndQuit, BTN);
}

function registerReps(i) {
  cur_mode = 1;

  g.clear();
  Bangle.drawWidgets();

  let sets = exs[i].sets;

  let cur_sets_label = sets.length == 0 ? "?" : sets.join("-") + "-?";

  let count_layout = new Layout(
    {type: "v",
     c: [
       {type: "txt", font: "6x8:2",
        fillx: 1, height: 30, wrap: true,
        label: exs[i].long},
       {height: 5},
       {type: "txt", font: "50%", label: "00", id: "reps"},
       {type: "txt", font: "6x8:2", label: cur_sets_label},
     ]},
    {back: selectEx,
     lazy: true,
     btns: [{label:"OK", cb: l => { sets.push(n); setRestTimer(); }}],
    });

  count_layout.update();

  let n = sets[sets.length - 1] || exs[i].default_reps;
  count_layout.reps.label = n;
  count_layout.render();

  Bangle.on('touch', (btn, _xy) => {
    n += btn == 1 ? -1 : 1;
    count_layout.reps.label = n;
    count_layout.render();
  });
}

function setRestTimer() {
  sched.setAlarm("rest-timer", {
    appid: "termux-workout",
    msg: "rest timer",
    on: true,
    timer: settings.rest_time_secs * 1000,
    js: 'ringRestTimer()',
  });
  sched.reload();
}

function ringRestTimer() {
  buzz.pattern(";.  ;.  ;.  ;.");
  sched.setAlarm("rest-timer", undefined);
  sched.reload();
}

function writeLogAndQuit() {
  if (!NRF.getSecurityStatus().connected) {
    E.showPrompt("No bluetooth device connected.", {
      title: "Error",
      buttons: { "Ok": true },
    }).then(selectEx);

    return;
  }

  let msg = "";

  for (let ex of exs)
    if (ex.sets.length > 0)
      msg += `${encodeURIComponent(ex.long)}+=+${ex.sets.join("-")}/`;

  if (msg != "")
    Bluetooth.println(JSON.stringify({
      t: "intent",
      target: "activity",
      action: "android.intent.action.SEND",
      mimetype: "text/plain",
      extra: {"android.intent.extra.TEXT": "http://example.com/" + msg},
      flags: ["FLAG_ACTIVITY_NEW_TASK"],
    }));

  quit();
}

function quit() {
  sched.setAlarm("rest-timer", undefined);
  sched.reload();
  Bangle.showClock();
}

function confirmQuit() {
  for (let ex of exs) {
    if (ex.sets.length != 0)
      break;
    return quit();
  }

  E.showPrompt("You have some reps logged. Are you sure you want to quit?",
               {title: "Confirm exit"})
    .then(v => {
      if (v)
        quit();
      else
        selectEx();
    });
}

selectEx();
