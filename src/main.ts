#!/usr/bin/env -S deno run -A

import {
  type Adw1_ as Adw_,
  type Gio2_ as Gio_,
  type GLib2_ as GLib_,
  type Gtk4_ as Gtk_,
  JSGLibEventLoop,
  kw,
  NamedArgument,
  python,
} from "gtk-py";

const APP_ID = "dev.mrcool.speedmon";
const APP_NAME = "SpeedMon";

const gi = python.import("gi");
gi.require_version("Gtk", "4.0");
gi.require_version("Adw", "1");

export const Gtk: Gtk_.Gtk = python.import("gi.repository.Gtk");
export const Adw: Adw_.Adw = python.import("gi.repository.Adw");
export const Gio: Gio_.Gio = python.import("gi.repository.Gio");
export const GLib: GLib_.GLib = python.import("gi.repository.GLib");
const el = new JSGLibEventLoop(GLib);

type TestType = "download" | "upload" | "ping" | null;

class MainWindow {
  #app: Adw_.Application;
  #win: Adw_.ApplicationWindow;
  #downloadButton: Gtk_.Button;
  #uploadButton: Gtk_.Button;
  #pingButton: Gtk_.Button;
  #stopButton: Gtk_.Button;
  #statusLabel: Gtk_.Label;
  #speedLabel: Gtk_.Label;
  #currentTest: TestType = null;
  #abortController: AbortController | null = null;
  #pingProcess: Deno.ChildProcess | null = null;
  #lastUploadSpeed: string = "--";

  constructor(app: Adw_.Application) {
    this.#app = app;

    // Create main window
    this.#win = new Adw.ApplicationWindow(
      new NamedArgument("application", app),
    );
    this.#win.set_title(APP_NAME);
    this.#win.set_default_size(400, 500);
    this.#win.connect("close-request", () => this.#onCloseRequest());

    // Create header bar
    const header = Adw.HeaderBar();

    // Create menu
    const menu = Gio.Menu.new();
    const popover = Gtk.PopoverMenu();
    popover.set_menu_model(menu);
    const hamburger = Gtk.MenuButton();
    hamburger.set_primary(true);
    hamburger.set_popover(popover);
    hamburger.set_icon_name("open-menu-symbolic");
    header.pack_start(hamburger);

    this.#createAction("about", this.#showAbout);
    menu.append("About SpeedMon", "app.about");
    this.#createAction("quit", () => this.#app.quit(), ["<primary>q"]);
    menu.append("Quit", "app.quit");

    // Create main content box
    const toolbarView = Adw.ToolbarView();
    toolbarView.add_top_bar(header);

    const mainBox = Gtk.Box(
      new NamedArgument("orientation", Gtk.Orientation.VERTICAL),
      new NamedArgument("spacing", 20),
    );
    mainBox.set_margin_top(40);
    mainBox.set_margin_bottom(40);
    mainBox.set_margin_start(40);
    mainBox.set_margin_end(40);
    mainBox.set_valign(Gtk.Align.CENTER);

    // Status card
    const statusGroup = Adw.PreferencesGroup();
    statusGroup.set_title("Connection Test");

    const statusBox = Gtk.Box(
      new NamedArgument("orientation", Gtk.Orientation.VERTICAL),
      new NamedArgument("spacing", 10),
    );
    statusBox.set_margin_top(20);
    statusBox.set_margin_bottom(20);
    statusBox.set_margin_start(20);
    statusBox.set_margin_end(20);

    this.#statusLabel = Gtk.Label();
    this.#statusLabel.set_markup("<b>Ready to test</b>");
    this.#statusLabel.set_wrap(true);

    this.#speedLabel = Gtk.Label();
    this.#speedLabel.set_markup('<span font="monospace 32">--</span>');
    this.#speedLabel.set_margin_top(10);

    statusBox.append(this.#statusLabel);
    statusBox.append(this.#speedLabel);

    const statusClamp = Adw.Clamp();
    statusClamp.set_child(statusBox);
    statusGroup.add(statusClamp);

    mainBox.append(statusGroup);

    // Buttons group
    const buttonsGroup = Adw.PreferencesGroup();
    buttonsGroup.set_title("Tests");

    // Download test button
    const downloadRow = Adw.ActionRow();
    downloadRow.set_title("Download Speed");
    downloadRow.set_subtitle("Continuous download speed test");
    this.#downloadButton = Gtk.Button();
    this.#downloadButton.set_icon_name("folder-download-symbolic");
    this.#downloadButton.set_valign(Gtk.Align.CENTER);
    this.#downloadButton.add_css_class("flat");
    this.#downloadButton.connect("clicked", () => this.#testDownload());
    downloadRow.add_suffix(this.#downloadButton);
    downloadRow.set_activatable_widget(this.#downloadButton);
    buttonsGroup.add(downloadRow);

    // Upload test button
    const uploadRow = Adw.ActionRow();
    uploadRow.set_title("Upload Speed");
    uploadRow.set_subtitle("Continuous upload speed test");
    this.#uploadButton = Gtk.Button();
    this.#uploadButton.set_icon_name("folder-upload-symbolic");
    this.#uploadButton.set_valign(Gtk.Align.CENTER);
    this.#uploadButton.add_css_class("flat");
    this.#uploadButton.connect("clicked", () => this.#testUpload());
    uploadRow.add_suffix(this.#uploadButton);
    uploadRow.set_activatable_widget(this.#uploadButton);
    buttonsGroup.add(uploadRow);

    // Ping test button
    const pingRow = Adw.ActionRow();
    pingRow.set_title("Ping Test");
    pingRow.set_subtitle("Continuous latency to 8.8.8.8");
    this.#pingButton = Gtk.Button();
    this.#pingButton.set_icon_name("network-transmit-receive-symbolic");
    this.#pingButton.set_valign(Gtk.Align.CENTER);
    this.#pingButton.add_css_class("flat");
    this.#pingButton.connect("clicked", () => this.#testPing());
    pingRow.add_suffix(this.#pingButton);
    pingRow.set_activatable_widget(this.#pingButton);
    buttonsGroup.add(pingRow);

    mainBox.append(buttonsGroup);

    // Stop button group
    const controlGroup = Adw.PreferencesGroup();
    controlGroup.set_description("Click 'Stop Test' to end the current test");
    this.#stopButton = Gtk.Button();
    this.#stopButton.set_label("Stop Test");
    this.#stopButton.add_css_class("destructive-action");
    this.#stopButton.set_margin_top(10);
    this.#stopButton.set_sensitive(false);
    this.#stopButton.connect("clicked", () => this.stopTest());
    controlGroup.add(this.#stopButton);

    mainBox.append(controlGroup);

    const clamp = Adw.Clamp();
    clamp.set_child(mainBox);
    clamp.set_maximum_size(600);

    toolbarView.set_content(clamp);
    this.#win.set_content(toolbarView);
  }

  #onCloseRequest() {
    this.stopTest();
    el.stop();
  }

  present() {
    this.#win.present();
  }

  #createAction(name: string, callback: () => void, shortcuts?: [string]) {
    const action = Gio.SimpleAction.new(name);
    action.connect("activate", callback);
    this.#app.add_action(action);
    if (shortcuts) this.#app.set_accels_for_action(`app.${name}`, shortcuts);
  }

  #showAbout = () => {
    const dialog = Adw.AboutWindow(
      new NamedArgument("transient_for", this.#app.get_active_window()),
    );
    dialog.set_application_name(APP_NAME);
    dialog.set_version("1.0.0");
    dialog.set_developer_name("MrCool");
    dialog.set_license_type(Gtk.License.MIT_X11);
    dialog.set_application_icon(APP_ID);
    dialog.set_comments("Monitor your network speed and latency");
    dialog.set_visible(true);
  };

  stopTest() {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    if (this.#pingProcess) {
      this.#pingProcess.kill("SIGTERM");
      this.#pingProcess = null;
    }
    this.#currentTest = null;
    this.#setStatus("Test stopped", "--");
    this.#enableButtons();
  }

  #disableButtons() {
    this.#downloadButton.set_sensitive(false);
    this.#downloadButton.set_opacity(0.5);
    this.#uploadButton.set_sensitive(false);
    this.#uploadButton.set_opacity(0.5);
    this.#pingButton.set_sensitive(false);
    this.#pingButton.set_opacity(0.5);
    this.#stopButton.set_sensitive(true);
    this.#stopButton.set_opacity(1.0);
  }

  #enableButtons() {
    this.#downloadButton.set_sensitive(true);
    this.#downloadButton.set_opacity(1.0);
    this.#uploadButton.set_sensitive(true);
    this.#uploadButton.set_opacity(1.0);
    this.#pingButton.set_sensitive(true);
    this.#pingButton.set_opacity(1.0);
    this.#stopButton.set_sensitive(false);
    this.#stopButton.set_opacity(0.5);
  }

  #setStatus(status: string, speed: string) {
    this.#statusLabel.set_markup(`<b>${status}</b>`);
    this.#speedLabel.set_markup(`<span font="monospace 32">${speed}</span>`);
  }

  async #testDownload() {
    this.#currentTest = "download";
    this.#disableButtons();
    this.#abortController = new AbortController();

    try {
      this.#setStatus("Testing download speed...", "0.00 MB/s");

      // Loop downloads continuously
      while (true) {
        if (this.#abortController?.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // Use a 100MB file for testing
        const url = "http://speedtest.tele2.net/100MB.zip";

        const startTime = Date.now();
        let lastUpdate = startTime;
        let bytesDownloaded = 0;

        const response = await fetch(url, {
          signal: this.#abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to start download");
        }

        const reader = response.body.getReader();

        while (true) {
          if (this.#abortController?.signal.aborted) {
            reader.cancel();
            throw new DOMException("Aborted", "AbortError");
          }

          const { done, value } = await reader.read();

          if (done) break;

          bytesDownloaded += value.length;

          const now = Date.now();
          const elapsed = (now - startTime) / 1000; // seconds

          // Update UI every 200ms
          if (now - lastUpdate > 200) {
            const speedMBps = bytesDownloaded / (elapsed * 1024 * 1024); // MB/s

            // Only update UI if download test is still active
            if (this.#currentTest === "download") {
              this.#setStatus(
                "Testing download speed...",
                `${speedMBps.toFixed(2)} MB/s`,
              );
            }

            lastUpdate = now;
          }
        }

        // Short pause before next download
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      // Only update UI if download test is still active
      if (this.#currentTest === "download") {
        if (error instanceof Error && error.name === "AbortError") {
          this.#setStatus("Test cancelled", "--");
        } else {
          this.#setStatus("Error: " + (error as Error).message, "--");
        }
      }
    } finally {
      this.#currentTest = null;
      this.#enableButtons();
      this.#abortController = null;
    }
  }

  async #testUpload() {
    this.#currentTest = "upload";
    this.#disableButtons();
    this.#abortController = new AbortController();

    try {
      this.#setStatus("Preparing upload test...", "--");

      let totalBytesUploaded = 0;

      // Loop uploads continuously
      while (true) {
        if (this.#abortController?.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // Upload size per iteration (5MB)
        const uploadSize = 5 * 1024 * 1024;
        const smallChunkSize = 65536; // 64KB per chunk for smooth updates
        let bytesGenerated = 0;

        // Generate data into array
        this.#setStatus("Generating data...", this.#lastUploadSpeed);
        const dataChunks: Uint8Array[] = [];

        while (bytesGenerated < uploadSize) {
          if (this.#abortController?.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          const remainingBytes = uploadSize - bytesGenerated;
          const chunkSize = Math.min(smallChunkSize, remainingBytes);
          const chunk = new Uint8Array(chunkSize);
          crypto.getRandomValues(chunk);
          dataChunks.push(chunk);
          bytesGenerated += chunkSize;
        }

        // Now upload the data
        const uploadStartTime = Date.now();
        this.#setStatus("Uploading...", this.#lastUploadSpeed);

        // Use httpbin.org for testing (it accepts POST)
        const response = await fetch("https://httpbin.org/post", {
          method: "POST",
          body: dataChunks,
          signal: this.#abortController.signal,
          headers: {
            "Content-Type": "application/octet-stream",
          },
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        // Consume the response
        await response.text();

        const uploadEndTime = Date.now();
        const uploadDuration = (uploadEndTime - uploadStartTime) / 1000;
        totalBytesUploaded += uploadSize;

        // Calculate and display speed based on upload time
        const speedMBps = uploadSize / (uploadDuration * 1024 * 1024);
        this.#lastUploadSpeed = `${speedMBps.toFixed(2)} MB/s`;

        // Only update UI if upload test is still active
        if (this.#currentTest === "upload") {
          this.#setStatus(
            "Upload complete, starting next...",
            this.#lastUploadSpeed,
          );
        }

        // Pause before next upload so user can see the result
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      // Only update UI if upload test is still active
      if (this.#currentTest === "upload") {
        if (error instanceof Error && error.name === "AbortError") {
          this.#setStatus("Test cancelled", "--");
        } else {
          this.#setStatus("Error: " + (error as Error).message, "--");
        }
      }
    } finally {
      this.#currentTest = null;
      this.#enableButtons();
      this.#abortController = null;
    }
  }

  async #testPing() {
    this.#currentTest = "ping";
    this.#disableButtons();

    try {
      this.#setStatus("Testing ping to 8.8.8.8...", "...");

      // Run continuous ping command
      const command = new Deno.Command("ping", {
        args: ["-i", "0.5", "8.8.8.8"],
        stdout: "piped",
        stderr: "piped",
      });

      this.#pingProcess = command.spawn();

      const decoder = new TextDecoder();
      const reader = this.#pingProcess.stdout.getReader();

      let buffer = "";
      const pings: number[] = [];

      while (true) {
        if (!this.#pingProcess) {
          // Process was killed by stop button
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          // Parse each ping result
          const match = line.match(/time=([\d.]+)/);
          if (match) {
            const pingTime = parseFloat(match[1]);
            pings.push(pingTime);

            // Keep only last 10 pings for average
            if (pings.length > 10) {
              pings.shift();
            }

            // Only update UI if ping test is still active
            if (this.#currentTest === "ping") {
              this.#setStatus(
                "Pinging 8.8.8.8...",
                `${pingTime.toFixed(1)} ms`,
              );
            }
          }
        }
      }

      // If we get here, the process ended
      if (
        pings.length > 0 && this.#pingProcess && this.#currentTest === "ping"
      ) {
        const avg = pings.reduce((a, b) => a + b, 0) / pings.length;
        this.#setStatus(
          "Ping test complete!",
          `${avg.toFixed(1)} ms`,
        );
      }
    } catch (error) {
      // Ignore errors if we stopped the test
      if (this.#currentTest === "ping") {
        this.#setStatus("Error: " + (error as Error).message, "--");
      }
    } finally {
      this.#currentTest = null;
      this.#enableButtons();
      this.#pingProcess = null;
    }
  }
}

class App extends Adw.Application {
  #win?: MainWindow;

  constructor(kwArg: NamedArgument) {
    super(kwArg);
    this.connect("activate", this.#onActivate);
  }

  // deno-lint-ignore no-explicit-any
  #onActivate = (_kwarg: any, app: Adw_.Application) => {
    if (!this.#win) {
      this.#win = new MainWindow(app);
    }
    this.#win.present();
  };

  stopTest = () => {
    this.#win?.stopTest();
  };
}

if (import.meta.main) {
  const app = new App(kw`application_id=${APP_ID}`);
  Deno.addSignalListener("SIGINT", () => {
    app.stopTest();
    el.stop();
  });
  el.start(app);
}
