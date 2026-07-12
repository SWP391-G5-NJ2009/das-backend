const app = require("./src/app");
const logger = require("./src/utils/logger");
const { startNoShowScheduler } = require("./src/jobs/noShowScheduler");
const { startVersionActivator } = require("./src/jobs/versionActivator");

const port = process.env.PORT || 3000;

app.listen(port, () => {
  logger.info(`DAS backend listening on port ${port}`);
  startNoShowScheduler();
  startVersionActivator();
});
