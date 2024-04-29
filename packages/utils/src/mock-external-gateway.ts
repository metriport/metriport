import express from "express";

const app = express();

app.use(express.json()); // Middleware to parse JSON bodies

app.get("*", async (req, res) => {
  const delay = Math.floor(Math.random() * 25000); // Random delay between 0-25 seconds
  await new Promise(resolve => setTimeout(resolve, delay));

  const responses = [{ success: true }, { success: false }, { error: "Simulated error" }];
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];

  if (randomResponse.error) {
    res.status(500).json(randomResponse);
  } else {
    res.json(randomResponse);
  }
});

app.listen(3000, () => {
  console.log("Mock external gateway server is running on port 3000");
});
