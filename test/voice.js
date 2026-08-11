/*
 * Voice capture test. Drives the real MediaRecorder path with Chrome's fake
 * audio device, so it exercises getUserMedia -> record -> encode -> POST.
 * The transcription response is stubbed (the fake device emits a tone, not
 * speech), which lets us assert the whole client pipeline deterministically.
 *
 *   npm i --no-save playwright && node test/voice.js
 */
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) {
  console.log("playwright not installed - skipping voice test.\n  npm i --no-save playwright");
  process.exit(0);
}
const CHROME = process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome-linux/chrome"]
    .find((p) => require("fs").existsSync(p));

const BASE = process.env.BASE || "http://localhost:3992";
let pass = 0, fail = 0;
const errors = [];
function check(name, ok, extra) {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

(async () => {
  const browser = await chromium.launch({
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 400, height: 850 },
    permissions: ["microphone"],
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/Failed to load resource/.test(t)) errors.push("console: " + t);
  });

  // Capture what the client actually sends to the transcription endpoint,
  // and stub the reply so the assertions don't depend on real speech audio.
  let sent = null;
  let transcript = "we should raise prices on the pro tier before the spring rush";
  await page.route("**/api/transcribe", async (route) => {
    try { sent = JSON.parse(route.request().postData() || "{}"); } catch (e) { sent = null; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: transcript }) });
  });
  // Stub refine too: no API key in test, and we're testing the voice path.
  await page.route("**/api/refine", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        title: "Raise pro tier pricing", project: "Pricing",
        venture: { id: "", name: "Pro Tier", kind: "running" },
        thesis: "Pricing should rise before the spring rush.",
        points: ["Spring rush is coming"], questions: ["What is churn risk?"],
        angles: ["Usage-based add-on"], risks: ["Assumes low price sensitivity"],
        actions: ["Model churn at the new price"],
      }),
    });
  });

  await page.goto(BASE, { waitUntil: "networkidle" });

  // --- 1. tapping the mic starts a real recording
  await page.locator("#fab").click();
  await page.waitForTimeout(1200);
  check("mic starts recording (no fallback to typing)", (await page.locator("#stopBtn").count()) === 1);
  check("recording timer is running", (await page.locator("#recTime").count()) === 1);

  // --- 2. stop -> transcribe -> note
  await page.locator("#stopBtn").click();
  await page.waitForTimeout(2500);

  check("audio was posted to /api/transcribe", !!sent && typeof sent.audio === "string" && sent.audio.length > 500,
    sent ? "audio chars: " + (sent.audio || "").length : "no request");
  check("audio sent as WAV", !!sent && sent.mime === "audio/wav", sent ? sent.mime : "-");

  const titles = await page.locator(".card-title").allInnerTexts();
  check("voice note was created", titles.includes("Raise pro tier pricing"), JSON.stringify(titles));

  await page.locator(".card").first().click();
  await page.waitForTimeout(300);
  const body = (await page.locator(".detail-body").innerText()).toLowerCase();
  check("voice note has thinking sections", body.includes("questions to answer"));
  await page.locator("#detClose").click();
  await page.waitForTimeout(200);

  // --- 3. spoken "add task" makes a task, not a note, and lands on Tasks
  const noteCount = () => page.evaluate(() =>
    (JSON.parse(localStorage.getItem("lucid:notes:v1") || "{}").notes || []).length);
  const notesBefore = await noteCount();
  transcript = "add task call the mulch supplier on monday";
  await page.locator("#fab").click();
  await page.waitForTimeout(1200);
  await page.locator("#stopBtn").click();
  await page.waitForTimeout(2000);
  check("spoken command created no note", (await noteCount()) === notesBefore);
  check("spoken task lands you on the Tasks view",
    (await page.locator('[data-view="tasks"].on').count()) === 1);
  const tasks = await page.locator(".task-text").allInnerTexts();
  check("spoken command created the task", tasks.some((t) => t.toLowerCase().includes("mulch supplier")), JSON.stringify(tasks));
  await page.locator('[data-view="library"]').click();
  await page.waitForTimeout(200);

  // --- 3b. "create task" with nothing after it asks instead of saving junk
  const before3 = await noteCount();
  transcript = "create task";
  await page.locator("#fab").click();
  await page.waitForTimeout(1200);
  await page.locator("#stopBtn").click();
  await page.waitForTimeout(2000);
  check("bare command saved no stray note", (await noteCount()) === before3);
  check("bare command opens the task box",
    await page.evaluate(() => document.activeElement && document.activeElement.id === "newTask"));
  await page.locator('[data-view="library"]').click();
  await page.waitForTimeout(200);

  // --- 4. spoken "just note" saves raw, without an AI call
  let refineCalled = false;
  await page.route("**/api/refine", async (route) => { refineCalled = true; await route.abort(); });
  transcript = "just note the truck lease is up for renewal in august";
  const before2 = await page.locator(".card").count();
  await page.locator("#fab").click();
  await page.waitForTimeout(1200);
  await page.locator("#stopBtn").click();
  await page.waitForTimeout(2000);
  check("raw voice note was saved", (await page.locator(".card").count()) === before2 + 1);
  check("no AI call for a raw voice note", refineCalled === false);
  const snippets = await page.locator(".card-thesis").allInnerTexts();
  check("raw note keeps the spoken words", snippets.some((t) => t.includes("truck lease")), JSON.stringify(snippets));

  // --- 5. spoken phrases file the item under the right business
  await page.addInitScript(() => {
    localStorage.setItem("lucid:notes:v1", JSON.stringify({
      notes: [], folders: [], tasks: [], standups: {}, manualOrder: [], sortMode: "newest",
      ventures: [{ id: "v_nw", name: "Northwind Farms LLC", kind: "running", createdAt: 1 },
                 { id: "v_hb", name: "Harbor", kind: "idea", createdAt: 2 }],
    }));
  });
  await page.reload({ waitUntil: "networkidle" });

  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem("lucid:notes:v1") || "{}"));
  async function speak(text, ms) {
    transcript = text;
    await page.locator("#fab").click();
    await page.waitForTimeout(1200);
    await page.locator("#stopBtn").click();
    await page.waitForTimeout(ms || 2000);
  }

  // trailing cue, with the legal suffix dropped the way people actually talk
  await speak("add task call the mulch supplier for Northwind");
  let s = await store();
  let t0 = s.tasks[0] || {};
  check("spoken task filed under the named business", t0.ventureId === "v_nw", JSON.stringify(t0));
  check("business name stripped from the task text", /^Call the mulch supplier$/i.test(t0.text || ""), JSON.stringify(t0.text));

  // leading cue, wrapping a note command
  await speak("for Harbor just note the truck lease is up in august");
  s = await store();
  let n0 = s.notes[0] || {};
  check("spoken note filed under the named business", n0.ventureId === "v_hb", JSON.stringify(n0.ventureId));
  check("cue phrase stripped from the note body", /^the truck lease is up in august$/i.test(n0.raw || ""), JSON.stringify(n0.raw));

  // colon form
  await speak("Northwind Farms LLC: task order more fencing");
  s = await store();
  t0 = s.tasks[0] || {};
  check("colon form routes and strips", t0.ventureId === "v_nw" && /^Order more fencing$/i.test(t0.text || ""), JSON.stringify(t0));

  // a bare mention still files it, but must not mangle the words
  await speak("add task email Harbor investors the deck");
  s = await store();
  t0 = s.tasks[0] || {};
  check("bare mention files without rewriting", t0.ventureId === "v_hb" && /^Email Harbor investors the deck$/i.test(t0.text || ""), JSON.stringify(t0));

  // --- 6. typed tasks route by phrase too, and group under the business
  await page.locator('[data-view="tasks"]').click();
  await page.waitForTimeout(300);
  await page.locator("#newTask").fill("call the vet for Northwind");
  await page.locator("#newTaskAdd").click();
  await page.waitForTimeout(400);
  s = await store();
  const typed = (s.tasks || []).filter((t) => /vet/i.test(t.text))[0] || {};
  check("typed task routes by phrase", typed.ventureId === "v_nw" && /^call the vet$/i.test(typed.text || ""), JSON.stringify(typed));
  const groups = await page.locator(".grp-name").allInnerTexts();
  // the group heading is uppercased by CSS, so compare case-insensitively
  check("tasks group under the business name",
    groups.some((g) => g.toLowerCase() === "northwind farms llc"), JSON.stringify(groups));

  await browser.close();
  console.log("\n  " + pass + " passed, " + fail + " failed");
  if (errors.length) { console.log("\n  JS ERRORS:"); errors.forEach((e) => console.log("   - " + e)); }
  else console.log("  No JS errors.");
  process.exit(fail || errors.length ? 1 : 0);
})().catch((e) => { console.error("HARNESS ERROR:", e.message); process.exit(1); });
