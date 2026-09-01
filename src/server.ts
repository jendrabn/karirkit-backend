import app from "./index";
import env from "./config/env.config";

const port = env.port;
app.set("port", port);

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
