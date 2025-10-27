# SpeedMon

A network speed monitoring application built with Deno and GTK4/Adwaita.

## Features

- **Download Speed Test**: Tests download speed using native JavaScript `fetch()` API
- **Upload Speed Test**: Tests upload speed by sending data to a test endpoint
- **Ping Test**: Measures network latency to Google DNS (8.8.8.8)
- Modern GTK4/Adwaita UI with clean design
- Real-time speed measurements displayed in MB/s and Mbps

## Prerequisites

- [Deno](https://deno.land/) (v1.40 or later)
- Python 3 with PyGObject (GTK4 bindings)
- GTK4 and libadwaita installed on your system

### Installing GTK4 and libadwaita

**On Ubuntu/Debian:**
```bash
sudo apt install python3-gi python3-gi-cairo gir1.2-gtk-4.0 gir1.2-adw-1
```

**On Fedora:**
```bash
sudo dnf install python3-gobject gtk4 libadwaita
```

**On Arch Linux:**
```bash
sudo pacman -S python-gobject gtk4 libadwaita
```

**On macOS (with Homebrew):**
```bash
brew install pygobject3 gtk4 libadwaita
```

## Installation

1. Clone or download this repository:
```bash
cd speedmon
```

2. Run the application:
```bash
deno task dev
```

Or run directly:
```bash
deno run --allow-read --allow-ffi --allow-env=DENO_PYTHON_PATH --allow-net --allow-run --unstable-ffi src/main.ts
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
Uses the native JavaScript `fetch()` API to download a 100MB file from speedtest.tele2.net. The application reads the response stream in chunks and calculates speed in real-time based on bytes downloaded and elapsed time.

### Upload Test
Generates 10MB of random data using `crypto.getRandomValues()` and uploads it to httpbin.org using a POST request. Measures the time taken to complete the upload.

### Ping Test
Uses Deno's `Deno.Command` API to execute the system's `ping` command and parses the output to extract average latency.

## Permissions

The application requires the following permissions:
- `--allow-net`: For download/upload speed tests
- `--allow-run`: For executing the ping command
- `--allow-ffi`: For GTK4 bindings via Python
- `--allow-env=DENO_PYTHON_PATH`: For Python environment configuration
- `--unstable-ffi`: For FFI features (required by deno-gtk-py)

## Technologies Used

- **Deno**: Modern JavaScript/TypeScript runtime
- **deno-gtk-py**: Python GTK bindings for Deno
- **GTK4**: Modern toolkit for creating graphical user interfaces
- **Libadwaita**: GNOME's library for modern adaptive UIs

## License

MIT

## Credits

Inspired by [Stimulator](https://github.com/sigmaSd/Stimulator) by sigmaSd