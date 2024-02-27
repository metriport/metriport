const express = require("express");

const ports = [8080, 8443, 8081, 8082, 8083, 8084, 8085, 8086, 9091, 9092];

ports.forEach(port => {
  const app = express();
  app.listen(port, "0.0.0.0", async () => {
    console.log(`Listening on port ${port}...`);
  });

  app.use((req, res) => {
    const method = req.method;
    const path = req.path;
    const message = `Got a request on port ${port} - ${method} ${path}`;
    console.log(message);
    return res.status(200).json({ port, method, path, status: "OK" });
  });
});
