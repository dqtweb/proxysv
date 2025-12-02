const express = require("express");
const path = require("path");

const app = express();
const port = Number(process.env.CLIENT_PORT) || 3000;
const publicDir = path.resolve(__dirname);

app.use((req, res, next) => {
  // Allow the WebSocket endpoint explicitly so the injected scripts can connect under CSP
  res.set(
    "Content-Security-Policy",
    "connect-src https: wss: ws://localhost:65432 blob:;"
  );
  next();
});

app.get(["/", "/control"], (req, res) =>
  res.sendFile(path.join(publicDir, "control.html"))
);
app.get("/control.html", (req, res) =>
  res.sendFile(path.join(publicDir, "control.html"))
);
app.get(["/sample", "/sample_client", "/sample_client.html"], (req, res) =>
  res.sendFile(path.join(publicDir, "sample_client.html"))
);
app.get("/inject.js", (req, res) =>
  res.sendFile(path.join(publicDir, "inject.js"))
);

app.listen(port, () => {
  console.log(`Client server running at http://localhost:${port}`);
  console.log("Routes:");
  console.log("  /control.html");
  console.log("  /sample_client.html");
});
