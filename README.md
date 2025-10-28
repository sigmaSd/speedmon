# SpeedMon

A network speed monitoring application built with Deno and GTK4/Adwaita.

## Features

- **Download Speed Test**: Tests download speed using native JavaScript
  `fetch()` API
- **Upload Speed Test**: Tests upload speed by sending data to a test endpoint
- **Ping Test**: Measures network latency to Google DNS (8.8.8.8)

# Installation

```bash
deno -A src/main.ts
```

## Usage

1. Launch the application
2. Click on any test button to start:
   - **Download Speed**: Downloads a test file from speedtest.tele2.net
   - **Upload Speed**: Uploads 10MB of data to httpbin.org
   - **Ping Test**: Sends 10 ping packets to 8.8.8.8
3. View real-time results displayed in the center of the window
4. Click "Stop Test" to abort an ongoing test

## How it Works

### Download Test

Uses the native JavaScript `fetch()` API to download a 100MB file from
speedtest.tele2.net. The application reads the response stream in chunks and
calculates speed in real-time based on bytes downloaded and elapsed time.

### Upload Test

Generates 10MB of random data using `crypto.getRandomValues()` and uploads it to
httpbin.org using a POST request. Measures the time taken to complete the
upload.

### Ping Test

Uses Deno's `Deno.Command` API to execute the system's `ping` command and parses
the output to extract average latency.

## License

MIT
