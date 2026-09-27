import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const mode = process.argv[2];
const specs = {
  home: { seconds: 24, route: "/" },
  jobs: { seconds: 16, route: "/explore/jobs" },
  participation: { seconds: 12, route: "/explore/participation" },
  sources: { seconds: 41, route: "/explore/jobs" },
  agent: { seconds: 50, route: "/" },
  "chat-sources": { seconds: 35, route: "/" },
  feedback: { seconds: 40, route: "/feedback" },
  "gallery-assistant": { seconds: 0, route: "/" },
  "gallery-jobs": { seconds: 0, route: "/explore/jobs" },
  "gallery-nearby": { seconds: 0, route: "/explore/nearby" },
  "gallery-feedback": { seconds: 0, route: "/feedback" },
};
if (!Object.hasOwn(specs, mode))
  throw new Error(`Choose one capture mode: ${Object.keys(specs).join(", ")}`);

const origin = new URL(
  process.env.ENVOY_CAPTURE_ORIGIN ?? "https://envoy.matteopolak.workers.dev",
);
if (origin.protocol !== "https:" || origin.pathname !== "/")
  throw new Error("ENVOY_CAPTURE_ORIGIN must be an HTTPS site origin");
const outputDir = resolve(
  process.env.ENVOY_CAPTURE_OUTPUT_DIR ??
    join(tmpdir(), "envoy-video-candidates"),
);
const chromePath =
  process.env.ENVOY_CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const isGallery = mode.startsWith("gallery-");
const viewport = isGallery
  ? { width: 1200, height: 800 }
  : { width: 1600, height: 812 };
const fps = 8;
const profile = mkdtempSync(join(tmpdir(), "envoy-video-chrome-"));
const frameDir = mkdtempSync(join(tmpdir(), `envoy-video-${mode}-frames-`));
mkdirSync(outputDir, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    `--window-size=${viewport.width},${viewport.height}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
let socket;
let sequence = 0;
const pending = new Map();
const actions = [];
const recordedAt = new Date().toISOString();

try {
  const portFile = join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100 && !existsSync(portFile); attempt++)
    await delay(100);
  if (!existsSync(portFile)) throw new Error("Chrome DevTools did not start");
  const port = Number(readFileSync(portFile, "utf8").split("\n")[0]);
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((res) =>
    res.json(),
  );
  const target = targets.find((entry) => entry.type === "page");
  if (!target) throw new Error("Chrome has no page target");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((accept, reject) => {
    socket.addEventListener("open", accept, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const response = JSON.parse(event.data);
    if (!response.id) return;
    const task = pending.get(response.id);
    if (!task) return;
    pending.delete(response.id);
    if (response.error) task.reject(new Error(response.error.message));
    else task.resolve(response.result);
  });

  async function command(method, params = {}) {
    const id = ++sequence;
    return await new Promise((accept, reject) => {
      pending.set(id, { resolve: accept, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.text ?? "Browser evaluation failed",
      );
    return result.result.value;
  }
  async function clickText(labels) {
    return await evaluate(`(() => {
      const labels = ${JSON.stringify(labels)};
      const nodes = Array.from(document.querySelectorAll('button,a,summary,[role="button"]'));
      const match = nodes.find((node) => labels.some((label) =>
        node.textContent?.trim() === label || node.getAttribute('aria-label') === label));
      if (!match) return false;
      match.focus(); match.click(); return true;
    })()`);
  }
  async function clickSelector(selector) {
    return await evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!(node instanceof HTMLElement)) return false;
      node.focus(); node.click(); return true;
    })()`);
  }
  async function typeText(selector, value) {
    return await evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!(node instanceof HTMLTextAreaElement)) return false;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(
        node, ${JSON.stringify(value)});
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.focus(); return true;
    })()`);
  }
  async function act(frame, label, operation) {
    const ok = await operation();
    actions.push({ frame, seconds: frame / fps, label, ok });
    process.stdout.write(`${label}=${ok}\n`);
  }

  await command("Page.enable");
  await command("Runtime.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    ...viewport,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await command("Page.navigate", {
    url: new URL(specs[mode].route, origin).href,
  });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate("document.readyState === 'complete'")) break;
    await delay(100);
  }
  await delay(1200);
  const stamp = recordedAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

  if (isGallery) {
    if (mode === "gallery-nearby") await delay(2600);
    if (mode === "gallery-feedback") {
      const filled = await typeText(
        "textarea",
        "The pedestrian signal near Queen Street and University Avenue in Toronto may be dark. Please review this concern.",
      );
      const reviewed = filled && (await clickText(["Review before sending"]));
      actions.push({ label: "open-feedback-review", ok: reviewed });
      if (!reviewed) throw new Error("Feedback review was unavailable");
      await delay(600);
    }
    const shot = await command("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const file = join(outputDir, `production-${mode}-${stamp}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    const sha256 = createHash("sha256")
      .update(readFileSync(file))
      .digest("hex");
    writeFileSync(
      `${file}.json`,
      JSON.stringify(
        {
          mode,
          origin: origin.href,
          route: specs[mode].route,
          recordedAt,
          viewport,
          file,
          sha256,
          actions,
          note: "Unaltered 3:2 production browser screenshot. Review its visible data and claims before using in the gallery.",
        },
        null,
        2,
      ) + "\n",
    );
    process.stdout.write(`output=${file}\nsha256=${sha256}\n`);
  } else {
    const issuePrompt =
      "How can I report a damaged bench at Nathan Phillips Square in Toronto? Prepare a report for me to review, but do not submit it.";
    const sourcePrompt =
      "Where can I find a Service BC office in Victoria? Show the official source.";
    const feedbackText =
      "The pedestrian signal near Queen Street and University Avenue in Toronto may be dark. Please review this concern.";
    const frameCount = specs[mode].seconds * fps;
    for (let frame = 0; frame < frameCount; frame++) {
      const started = Date.now();
      if (mode === "home") {
        if (frame === 4 * fps)
          await act(frame, "open-add-menu", () =>
            clickSelector(".chat-add-button"),
          );
        if (frame === 14 * fps)
          await act(frame, "return-to-add-menu", () =>
            clickSelector(".chat-add-button"),
          );
        if (frame === 18 * fps)
          await act(frame, "open-model-choice", () =>
            clickSelector(".chat-model-button"),
          );
        if (frame === 22 * fps)
          await act(frame, "close-model-choice", () =>
            clickSelector(".chat-model-button"),
          );
      }
      if (mode === "sources") {
        if (frame === 23 * fps)
          await act(frame, "participation", () => clickText(["Participation"]));
        if (frame === 32 * fps)
          await act(frame, "nearby", () => clickText(["Nearby"]));
        if (frame === 36 * fps)
          await act(frame, "select-map-pin", () =>
            evaluate(`(() => {
            const pin = document.querySelector('.nearby-map-marker');
            if (!pin) return false;
            pin.click(); return true;
          })()`),
          );
        if (frame === 39 * fps)
          await act(frame, "list", () => clickText(["List"]));
      }
      if (mode === "agent" || mode === "chat-sources") {
        const prompt = mode === "agent" ? issuePrompt : sourcePrompt;
        const typeStart = 3 * fps;
        const typeEnd = 9 * fps;
        if (frame >= typeStart && frame <= typeEnd) {
          const portion = Math.min(
            prompt.length,
            Math.ceil(
              ((frame - typeStart + 1) / (typeEnd - typeStart + 1)) *
                prompt.length,
            ),
          );
          await typeText("textarea", prompt.slice(0, portion));
        }
        if (frame === 10 * fps)
          await act(frame, "send", () => clickText(["Send", "Send message"]));
      }
      if (mode === "feedback") {
        const typeStart = 2 * fps;
        const typeEnd = 13 * fps;
        if (frame >= typeStart && frame <= typeEnd) {
          const portion = Math.min(
            feedbackText.length,
            Math.ceil(
              ((frame - typeStart + 1) / (typeEnd - typeStart + 1)) *
                feedbackText.length,
            ),
          );
          await typeText("textarea", feedbackText.slice(0, portion));
        }
        if (frame === 16 * fps)
          await act(frame, "review", () =>
            clickText([
              "Review before sending",
              "Review report",
              "Review and send",
            ]),
          );
      }
      const shot = await command("Page.captureScreenshot", {
        format: "jpeg",
        quality: 84,
        captureBeyondViewport: false,
      });
      writeFileSync(
        join(frameDir, `${String(frame).padStart(4, "0")}.jpg`),
        Buffer.from(shot.data, "base64"),
      );
      const remaining = 1000 / fps - (Date.now() - started);
      if (remaining > 0) await delay(remaining);
    }

    const file = join(outputDir, `production-${mode}-${stamp}.mp4`);
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-framerate",
      String(fps),
      "-i",
      join(frameDir, "%04d.jpg"),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "15",
      file,
    ]);
    const sha256 = createHash("sha256")
      .update(readFileSync(file))
      .digest("hex");
    const metadata = {
      mode,
      origin: origin.href,
      route: specs[mode].route,
      recordedAt,
      viewport,
      fps,
      seconds: specs[mode].seconds,
      file,
      frameDir,
      sha256,
      actions,
      note: "Isolated headless Chrome captured the deployed product. Review frames and claims before selecting this clip for the video.",
    };
    writeFileSync(`${file}.json`, JSON.stringify(metadata, null, 2) + "\n");
    process.stdout.write(`output=${file}\nsha256=${sha256}\n`);
  }
} finally {
  socket?.close();
  chrome.kill("SIGTERM");
  await delay(500);
  rmSync(profile, { recursive: true, force: true });
}
