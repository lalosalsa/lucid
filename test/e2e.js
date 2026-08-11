/*
 * End-to-end UI test. Playwright is intentionally NOT a package.json dependency
 * (it would slow every deploy build), so install it once to run this:
 *   npm i --no-save playwright
 * Then, with the app running on :3992:  npm run test:e2e
 */
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) {
  console.log("playwright not installed - skipping UI test.\n  npm i --no-save playwright");
  process.exit(0);
}
const CHROME = process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome-linux/chrome"]
    .find((p) => require("fs").existsSync(p));

const BASE = process.env.BASE || "http://localhost:3992";
const errors = [];
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

(async () => {
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const ctx = await browser.newContext({ viewport: { width: 400, height: 850 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { const t=m.text(); if (m.type()==="error" && !/Failed to load resource/.test(t) && !/could not start recording/.test(t)) errors.push("console: "+t); });

  // ---- 1. cold load
  await page.goto(BASE, { waitUntil: "networkidle" });
  check("page loads", await page.locator(".brandtype").isVisible());
  check("FAB present", await page.locator("#fab").isVisible());
  check("tab bar renders", (await page.locator("#tabbar .tab").count()) === 2);
  check("empty state shown", (await page.locator(".empty-state h2").first().innerText()).includes("Nothing captured"));

  // ---- 2. Tasks tab: add a task by hand
  await page.locator('[data-view="tasks"]').click();
  check("tasks add-row visible", await page.locator("#newTask").isVisible());
  await page.locator("#newTask").fill("Call the mulch supplier");
  await page.locator("#newTaskAdd").click();          // the + button, not just Enter
  await page.waitForTimeout(200);
  const taskTexts = await page.locator(".task-text").allInnerTexts();
  check("manual task appears", taskTexts.some((t) => t.includes("mulch supplier")), JSON.stringify(taskTexts));
  check("tab badge counts it", (await page.locator(".tab-badge").innerText()) === "1");
  check("input clears after add", (await page.locator("#newTask").inputValue()) === "");
  await page.locator("#newTask").fill("Second task via Enter");
  await page.locator("#newTask").press("Enter");
  await page.waitForTimeout(200);
  check("Enter key also adds", (await page.locator(".task-text").allInnerTexts()).some((t) => t.includes("Second task")));

  // toggle done
  await page.locator(".tcheck").first().click();
  await page.waitForTimeout(150);
  check("task completes", (await page.locator(".grp.done-grp").count()) === 1);
  await page.locator(".tcheck").first().click();
  await page.waitForTimeout(150);

  // ---- 3. Businesses: create, rename, kind
  await page.locator('[data-view="library"]').click();
  await page.locator('[data-seg="ventures"]').click();
  await page.waitForTimeout(100);
  check("businesses tab opens", await page.locator("#newVentureBtn").isVisible());
  await page.locator("#newVentureBtn").click();
  await page.locator("#ventureNameInput").fill("Acme Landscaping");
  await page.locator("#ventureAdd").click();
  await page.waitForTimeout(150);
  check("business created", (await page.locator(".vcard .proj-name").first().innerText()) === "Acme Landscaping");
  check("kind badge shows", (await page.locator(".kind-badge").first().innerText()).length > 0);

  // add a second one to test ordering UI exists
  await page.locator("#newVentureBtn").click();
  await page.locator("#ventureNameInput").fill("Dental SaaS idea");
  await page.locator("#vKind").selectOption("idea");
  await page.locator("#ventureAdd").click();
  await page.waitForTimeout(150);
  check("two businesses listed", (await page.locator(".vcard").count()) === 2);
  check("drag handles present", (await page.locator(".vcard .grip").count()) === 2);

  // open one -> rename
  await page.locator(".vcard-body").first().click();
  await page.waitForTimeout(150);
  check("business detail opens", await page.locator("#renBtn").isVisible());
  check("'Where it stands' button", await page.locator("#standBtn").isVisible());
  await page.locator("#renBtn").click();
  await page.locator("#renInput").fill("Acme Lawn Co");
  await page.locator("#renSave").click();
  await page.waitForTimeout(150);
  await page.locator("#backBtn").click();
  await page.waitForTimeout(150);
  const names = await page.locator(".vcard .proj-name").allInnerTexts();
  check("rename persisted", names.includes("Acme Lawn Co"), JSON.stringify(names));

  // ---- 4. Seed a note (simulating a successful capture) and exercise detail
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("lucid:notes:v1") || "{}");
    const vid = (raw.ventures && raw.ventures[0] && raw.ventures[0].id) || null;
    raw.notes = [{
      id: "n_test1", createdAt: Date.now(), lens: "operator",
      raw: "we should raise prices on the pro tier because support costs are eating us",
      title: "Raise pro tier pricing", project: "Pricing", ventureId: vid,
      thesis: "Pro tier pricing no longer covers its support burden.",
      points: ["Support costs are climbing", "Power users consume the most seats"],
      questions: ["What is churn risk at $49?", "Do you grandfather existing accounts?"],
      angles: ["Introduce a usage-based add-on instead"],
      risks: ["Assumes power users are price-insensitive"],
      actions: [],
      suggestions: ["Model churn at $49", "Draft the grandfather policy"],
      thread: []
    }];
    localStorage.setItem("lucid:notes:v1", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  check("note card renders", (await page.locator(".card-title").first().innerText()) === "Raise pro tier pricing");
  const meta = await page.locator(".card-meta").first().innerText();
  check("card shows question count", meta.includes("question"), meta);
  check("card shows suggested count", meta.includes("suggested"), meta);

  await page.locator(".card").first().click();
  await page.waitForTimeout(200);
  const body = (await page.locator(".detail-body").innerText()).toLowerCase();
  check("thinking sections render", body.includes("questions to answer") && body.includes("angles to consider") && body.includes("watch out for"));
  check("business chip section", body.includes("business"));
  check("Go deeper button", await page.locator("#goDeeper").isVisible());

  // suggestions are opt-in, not auto-added
  check("suggestions block renders", (await page.locator(".sugg-row").count()) === 2);
  check("no tasks auto-added", (await page.locator(".actions-block .taskbtn").count()) === 0);
  await page.locator(".sugg-add").first().click();
  await page.waitForTimeout(200);
  check("accepting a suggestion creates a task", (await page.locator(".actions-block .taskbtn").count()) === 1);
  check("accepted suggestion removed from list", (await page.locator(".sugg-row").count()) === 1);
  await page.locator(".sugg-no").first().click();
  await page.waitForTimeout(200);
  check("dismissing a suggestion removes it", (await page.locator(".sugg-row").count()) === 0);

  // rename note title
  await page.locator("#titleTap").click();
  await page.waitForTimeout(120);
  await page.locator("#titleInput").fill("Pro tier price increase");
  await page.locator("#titleSave").click();
  await page.waitForTimeout(180);
  check("note title renamed", (await page.locator(".detail-title").innerText()) === "Pro tier price increase");

  // add task inside note
  await page.locator("#addTaskBtn").click();
  await page.locator("#noteTaskInput").fill("Draft grandfather policy");
  await page.locator("#noteTaskAdd").click();
  await page.waitForTimeout(200);
  const acts = await page.locator(".actions-block").innerText();
  check("in-note task added", acts.includes("Draft grandfather policy"), acts);

  // thread panel opens
  await page.locator("#goDeeper").click();
  await page.waitForTimeout(200);
  check("thread opens", await page.locator("#devInput").isVisible());
  check("starter chips from questions", (await page.locator(".starter").count()) > 0);

  await page.locator("#detClose").click();
  await page.waitForTimeout(150);

  // ---- 5. sort by business
  const pill = page.locator("#sortPill");
  let label = "";
  for (let i = 0; i < 4; i++) {
    label = await pill.innerText();
    if (label.includes("business")) break;
    await pill.click();
    await page.waitForTimeout(120);
  }
  check("sort has 'By business'", label.includes("business"), label);
  check("grouped headers render", (await page.locator("#libBody .grp-h").count()) > 0);

  // ---- 6. search
  await page.locator("#libSearch").fill("pricing");
  await page.waitForTimeout(200);
  check("search finds note", (await page.locator(".card").count()) >= 1);
  await page.locator("#libClr").click();
  await page.waitForTimeout(150);

  // ---- 6b. "add task" command creates a task, not a note
  const notesBefore = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem("lucid:notes:v1") || "{}").notes || []).length);
  await page.locator("#fab").click();
  await page.waitForTimeout(500);
  const typing = await page.locator("#typed").count();
  check("capture falls back to typing without a mic", typing === 1);
  if (typing) {
    await page.locator("#typed").fill("add task: order new business cards");
    await page.locator("#refineTyped").click();
    await page.waitForTimeout(500);
    // a task command lands you on Tasks, so count stored notes rather than cards
    const stored = await page.evaluate(() =>
      (JSON.parse(localStorage.getItem("lucid:notes:v1") || "{}").notes || []).length);
    check("command made no new note", stored === notesBefore);
    check("task command lands on the Tasks view",
      (await page.locator('[data-view="tasks"].on').count()) === 1);
    await page.waitForTimeout(200);
    const tt = await page.locator(".task-text").allInnerTexts();
    check("command created the task", tt.some((t) => t.toLowerCase().includes("business cards")), JSON.stringify(tt));
    await page.locator('[data-view="library"]').click();
    await page.waitForTimeout(150);
  }

  // ---- 6c. write a note by hand, then expand it later
  await page.locator('[data-seg="notes"]').count().then(async (c) => { if (c) await page.locator('[data-seg="notes"]').click(); });
  await page.waitForTimeout(150);
  check("New note button present", await page.locator("#newNoteBtn").isVisible());
  await page.locator("#newNoteBtn").click();
  await page.waitForTimeout(200);
  check("new-note sheet opens", await page.locator("#nnBody").isVisible());
  check("save disabled while empty", await page.locator("#nnSave").isDisabled());
  await page.locator("#nnTitle").fill("Supplier renegotiation");
  await page.locator("#nnBody").fill("Mulch is up 18% since spring. Ask Kyle for volume pricing before the May order.");
  await page.waitForTimeout(120);
  check("save enables with content", !(await page.locator("#nnSave").isDisabled()));
  await page.locator("#nnSave").click();
  await page.waitForTimeout(300);
  const titles = await page.locator(".card-title").allInnerTexts();
  check("written note appears", titles.includes("Supplier renegotiation"), JSON.stringify(titles));
  const rawCard = page.locator(".card", { hasText: "Supplier renegotiation" }).first();
  check("shows 'not expanded'", (await rawCard.innerText()).toLowerCase().includes("not expanded"), await rawCard.innerText());

  await rawCard.click();
  await page.waitForTimeout(250);
  const rawBody = await page.locator(".detail-body").innerText();
  check("body shown in full", rawBody.includes("volume pricing"), rawBody.slice(0, 120));
  // An operational note has no bet to pressure-test, so expansion is not pitched -
  // but it stays reachable in the action row.
  check("no expansion pitch on an operational note", (await page.locator("#expandAI").count()) === 0);
  check("expand still reachable in the action row",
    (await page.locator("#sharpen").innerText()).toLowerCase().includes("expand"),
    await page.locator("#sharpen").innerText());
  check("no redundant raw toggle", (await page.locator("#rawToggle").count()) === 0);
  await page.locator("#detClose").click();
  await page.waitForTimeout(150);

  // ---- notes are auto-formatted by Claude after they are saved
  let formatCalls = 0, formatSent = null;
  await page.route("**/api/format", async (route) => {
    formatCalls++;
    try { formatSent = JSON.parse(route.request().postData() || "{}"); } catch (e) { formatSent = null; }
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ title: "Crew start time", body: "The crew starts at seven.\n- Gate code is 4412." }),
    });
  });
  await page.locator("#newNoteBtn").click();
  await page.waitForTimeout(200);
  await page.locator("#nnBody").fill("um so the crew starts at seven, you know, and uh the gate code is 4412");
  await page.waitForTimeout(120);
  await page.locator("#nnSave").click();
  await page.waitForTimeout(900);
  check("note was sent for formatting", formatCalls === 1, "calls: " + formatCalls);
  check("the captured words were sent, not the title",
    !!formatSent && /gate code is 4412/.test(formatSent.raw || ""), JSON.stringify(formatSent));
  const fmtStore = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem("lucid:notes:v1") || "{}").notes || [])[0]);
  check("formatted body replaced the raw capture",
    /The crew starts at seven\./.test(fmtStore.raw || "") && !/um so/.test(fmtStore.raw || ""), JSON.stringify(fmtStore.raw));
  check("Claude's title was applied", fmtStore.title === "Crew start time", JSON.stringify(fmtStore.title));
  check("formatting does not expand the note", !fmtStore.thesis && !(fmtStore.points || []).length);

  // a title they typed themselves is theirs to keep
  await page.locator("#newNoteBtn").click();
  await page.waitForTimeout(200);
  await page.locator("#nnTitle").fill("My own title");
  await page.locator("#nnBody").fill("um the crew starts at seven");
  await page.waitForTimeout(120);
  await page.locator("#nnSave").click();
  await page.waitForTimeout(900);
  const ownTitle = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem("lucid:notes:v1") || "{}").notes || [])[0]);
  check("a title you typed survives formatting", ownTitle.title === "My own title", JSON.stringify(ownTitle.title));
  check("the body is still formatted", /crew starts at seven\./i.test(ownTitle.raw || ""), JSON.stringify(ownTitle.raw));

  // a formatting failure must never cost the capture
  await page.unroute("**/api/format");
  await page.route("**/api/format", (route) =>
    route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"format_failed"}' }));
  await page.locator("#newNoteBtn").click();
  await page.waitForTimeout(200);
  await page.locator("#nnBody").fill("the fence posts arrive thursday");
  await page.waitForTimeout(120);
  await page.locator("#nnSave").click();
  await page.waitForTimeout(900);
  const kept = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem("lucid:notes:v1") || "{}").notes || [])[0]);
  check("note survives a formatting failure", /fence posts arrive thursday/.test(kept.raw || ""), JSON.stringify(kept.raw));
  await page.unroute("**/api/format");

  // ---- an idea-shaped note DOES get the pitch
  await page.locator("#newNoteBtn").click();
  await page.waitForTimeout(200);
  await page.locator("#nnTitle").fill("Second yard");
  await page.locator("#nnBody").fill("Thinking about whether we could open a second yard out in Fayette county. Would customers drive that far?");
  await page.waitForTimeout(120);
  await page.locator("#nnSave").click();
  await page.waitForTimeout(300);
  const ideaCard = page.locator(".card", { hasText: "Second yard" }).first();
  check("idea card flagged 'worth expanding'",
    (await ideaCard.innerText()).toLowerCase().includes("worth expanding"), await ideaCard.innerText());
  await ideaCard.click();
  await page.waitForTimeout(250);
  check("expansion pitched on an idea", await page.locator("#expandAI").isVisible());
  await page.locator("#detClose").click();
  await page.waitForTimeout(150);

  // capture sheet offers save-as-is
  await page.locator("#fab").click();
  await page.waitForTimeout(500);
  if ((await page.locator("#typed").count()) === 1) {
    check("save-as-is disabled while empty", await page.locator("#saveRaw").isDisabled());
    await page.locator("#typed").fill("Quick thought about the truck lease renewal");
    await page.waitForTimeout(120);
    check("save-as-is enables", !(await page.locator("#saveRaw").isDisabled()));
    await page.locator("#saveRaw").click();
    await page.waitForTimeout(300);
    const t2 = await page.locator(".card-thesis").allInnerTexts();
    check("captured text saved without AI", t2.some((t) => t.includes("truck lease")), JSON.stringify(t2));
  }

  // ---- 6d. completed tasks can be removed
  await page.locator('[data-view="tasks"]').click();
  await page.waitForTimeout(200);
  const beforeDel = (await page.locator(".task-text").allInnerTexts()).length;
  check("no delete on an open task", (await page.locator('.solo-del[data-delnote]').count()) === 0);
  const noteCheck = page.locator('.tcheck[data-note]').first();
  await noteCheck.click();
  await page.waitForTimeout(250);
  check("delete appears once done", (await page.locator('.solo-del[data-delnote]').count()) >= 1);
  await page.locator('.solo-del[data-delnote]').first().click();
  await page.waitForTimeout(250);
  check("completed task removed", (await page.locator(".task-text").allInnerTexts()).length === beforeDel - 1);

  // ---- 6e. folders
  await page.locator('[data-view="library"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-seg="folders"]').click();
  await page.waitForTimeout(200);
  check("folders tab opens", await page.locator("#newFolderBtn").isVisible());
  await page.locator("#newFolderBtn").click();
  await page.locator("#folderNameInput").fill("Q2 planning");
  await page.locator("#folderAdd").click();
  await page.waitForTimeout(250);
  check("folder created", (await page.locator(".vcard .proj-name").allInnerTexts()).includes("Q2 planning"));
  await page.locator("[data-openf]").first().click();
  await page.waitForTimeout(200);
  check("folder detail opens", await page.locator("#fRenBtn").isVisible());
  await page.locator("#fRenBtn").click();
  await page.locator("#fRenInput").fill("Q2 push");
  await page.locator("#fRenSave").click();
  await page.waitForTimeout(250);
  await page.locator("#backBtn").click();
  await page.waitForTimeout(200);
  check("folder renamed", (await page.locator(".vcard .proj-name").allInnerTexts()).includes("Q2 push"));

  // file a note into the folder from the note detail
  await page.locator('[data-seg="notes"]').click();
  await page.waitForTimeout(200);
  await page.locator(".card").first().click();
  await page.waitForTimeout(250);
  check("folder picker in note", (await page.locator("#noteFolderChips .chip").count()) >= 2);
  await page.locator('#noteFolderChips .chip[data-nfid]:not([data-nfid=""])').first().click();
  await page.waitForTimeout(250);
  await page.locator("#detClose").click();
  await page.waitForTimeout(200);
  await page.locator('[data-seg="folders"]').click();
  await page.waitForTimeout(200);
  await page.locator("[data-openf]").first().click();
  await page.waitForTimeout(250);
  check("note appears in folder", (await page.locator(".card").count()) >= 1);
  await page.locator("#backBtn").click();
  await page.waitForTimeout(150);
  await page.locator('[data-seg="notes"]').click();
  await page.waitForTimeout(150);

  // ---- 7. persistence across reload
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  await page.locator('[data-view="tasks"]').click();
  await page.waitForTimeout(150);
  const after = await page.locator(".task-text").allInnerTexts();
  check("data persists after reload", after.some((t) => t.includes("mulch")) && after.some((t) => t.toLowerCase().includes("grandfather")), JSON.stringify(after));

  await browser.close();
  console.log("\n  " + pass + " passed, " + fail + " failed");
  if (errors.length) { console.log("\n  JS ERRORS:"); errors.forEach((e) => console.log("   - " + e)); }
  else console.log("  No JS errors.");
  process.exit(fail || errors.length ? 1 : 0);
})().catch((e) => { console.error("HARNESS ERROR:", e.message); process.exit(1); });
