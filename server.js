const app = require("./src/app");
const { startNoShowScheduler } = require("./src/jobs/noShowScheduler");

const port = process.env.PORT || 3000;

app.listen(port, () => {
  startNoShowScheduler();
});
