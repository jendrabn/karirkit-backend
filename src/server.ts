import app from "./index";
import env from "./config/env.config";
import { appLogger } from "./middleware/logger.middleware";

const port = env.port;
app.set("port", port);

app.listen(port, () => {
  appLogger.info(`Server running on port ${port}`);
});
