(function(back) {
  var FILE = "termux-workout-tracker.json";

  var settings = Object.assign({
    rest_time_secs: 120,
  }, require('Storage').readJSON(FILE, true) || {});

  function writeSettings() {
    require('Storage').writeJSON(FILE, settings);
  }

  E.showMenu({
    "" : { "title" : "Workout Tracker (Termux)" },
    "< Back" : () => back(),
    'Rest time (s)': {
      value: settings.rest_time_secs,
      min: 0, max: 600, step: 5,
      onchange: v => {
        settings.rest_time_secs = v;
        writeSettings();
      }
    },
  });
})