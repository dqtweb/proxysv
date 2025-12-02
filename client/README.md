# Client harness

This folder runs a minimal Node.js stack for the browser control/sample clients:

- `server.js` serves `control.html`, `sample_client.html`, and `inject.js` with a CSP header that allows the WebSocket endpoint.
- `puppeteer-test.js` launches Chromium, loads the control page, inspects the CSP header, and captures a screenshot.

## Getting started

```bash
cd client
npm install
npm start          # runs the express server on http://localhost:3000
npm run test:csp   # requires the server to be running
```

Export `CLIENT_SERVER_URL` or `WS_PROXY_ENDPOINT` if your server runs elsewhere.
