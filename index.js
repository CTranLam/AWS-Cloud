import express from "express";
import os from "os";
import bodyParser from "body-parser";


const app = express();


app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(
  bodyParser.urlencoded({
    // to support URL-encoded bodies
    extended: true,
  })
);

const BACKGROUND_COLOR = process.env.BACKGROUND_COLOR || "#283E5B";
const APP_PORT = process.env.PORT || 8080;


const users = [
  { id: 1, name: "viet" },
  { id: 2, name: "aws" },
  { id: 3, name: "david" },
  { id: 4, name: "mina" },
  { id: 5, name: "jennie" },
];

const products = [
  { id: 1, name: "Keyboard", qty: 2 },
  { id: 2, name: "Monitor", qty: 3 },
  { id: 3, name: "Mouse", qty: 5 },
  { id: 4, name: "Camera", qty: 1 },
  { id: 5, name: "Microphone", qty: 2 },
];

app.get("/", async (req, res) => {
  try {

    const containerIp = req.socket.localAddress;
    const containerName = os.hostname();
    console.log("os hostname: ", os.hostname());
    const ip = containerIp.split(":")[3];
    const version = 1;
    const bgColor = BACKGROUND_COLOR;
    const html = `
    <html>
    <head>
      <title>Application Demo</title>
    </head>
    <body style='background-color: ${bgColor}; color: wheat;text-align: center;'>
      <h1 style='color: orange'>Welcome to AWS</h1>
      <h3>Container name: <span style='color: pink'>${containerName}</span></h3>
      <h3>Container's IP Address: <span style='color: pink'>${ip}</span></h3>
      <h3>Application Version: <span style='color: coral'>V${version}</span></h3>
    <body>
    </html>
    `;
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


app.get("/users", async (req, res) => {
  try {
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const user = users.find((user) => user.id == id);
    if (user) res.json(user);
    else res.status(404).send("Not Found");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/products", async (req, res) => {
  try {
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const product = products.find((product) => product.id == id);
    if (product) res.json(product);
    else res.status(404).send("Not Found");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


app.listen(APP_PORT, () => {
  console.log(`Server is running at port ${APP_PORT}!`);
});