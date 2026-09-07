const events = [];
const MAX = 200;
function log(entry) {
  events.push(Object.assign({ t: Date.now() }, entry));
  if (events.length > MAX) events.shift();
}
function all() { return events.slice(); }
module.exports = { log, all };