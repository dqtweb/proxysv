const puppeteer = require("puppeteer");

const BASE_URL = process.env.CLIENT_SERVER_URL || "http://localhost:3000";

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const response = await page.goto(`${BASE_URL}/control.html`, {
      waitUntil: "networkidle0",
    });
    if (!response) {
      throw new Error("Failed to load control page");
    }

    const cspHeader = response.headers()["content-security-policy"];
    console.log("Content-Security-Policy header:", cspHeader || "<not set>");

    await page.waitForSelector("#connect", { timeout: 3000 });
    await page.waitForSelector("#log");

    const statusText = await page.$eval("#status", (el) => el.textContent);
    console.log("Status element contains:", statusText.trim());

    await page.screenshot({ path: "control-page.png", fullPage: true });
    console.log("Captured screenshot of the control page to control-page.png");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Puppeteer test failed:", err);
  process.exit(1);
});
