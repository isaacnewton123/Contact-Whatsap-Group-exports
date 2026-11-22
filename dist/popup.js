import { baseName, toCsv, toVcf, toXls } from "./format.js";
function isStatus(response) {
    return response.ok && "groupCount" in response;
}
function isExport(response) {
    return response.ok && "rows" in response;
}
const PREVIEW_LIMIT = 150;
let exportData = null;
let canExportActive = false;
let canExportAll = false;
function byId(id) {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`Missing #${id}`);
    return element;
}
function setBusy(busy) {
    byId("btn-active").disabled = busy || !canExportActive;
    byId("btn-all").disabled = busy || !canExportAll;
    byId("btn-retry").disabled = busy;
    const downloadsReady = !busy && exportData !== null;
    ["btn-xls", "btn-csv", "btn-vcf", "btn-copy"].forEach((id) => {
        byId(id).disabled = !downloadsReady;
    });
}
function showGate(message, canRetry, loading = false) {
    byId("gate").hidden = false;
    byId("workspace").hidden = true;
    byId("spinner").hidden = !loading;
    byId("gate-text").textContent = message;
    byId("btn-retry").hidden = !canRetry;
}
function clearError() {
    const error = byId("form-error");
    error.hidden = true;
    error.textContent = "";
}
function showError(message) {
    const error = byId("form-error");
    error.hidden = false;
    error.textContent = message;
}
function fillCard(label, title, detail) {
    const card = byId("active-card");
    card.replaceChildren();
    const labelNode = document.createElement("p");
    labelNode.className = "eyebrow";
    labelNode.textContent = label;
    const titleNode = document.createElement("h2");
    titleNode.textContent = title;
    const detailNode = document.createElement("p");
    detailNode.className = "meta";
    detailNode.textContent = detail;
    card.append(labelNode, titleNode, detailNode);
}
function showWorkspace(status) {
    byId("gate").hidden = true;
    byId("workspace").hidden = false;
    const groupCount = `${status.groupCount} ${status.groupCount === 1 ? "group" : "groups"} on this account.`;
    if (status.activeIsGroup) {
        const loaded = status.activeCount && status.activeCount > 0
            ? `${status.activeCount} members already loaded. `
            : "Members are read when you export. ";
        fillCard("Open group", status.activeTitle, loaded + groupCount);
    }
    else if (status.activeTitle) {
        fillCard("Not a group", status.activeTitle, `${groupCount} Open a group to export just that one.`);
    }
    else {
        fillCard("No chat open", "Choose a group in WhatsApp Web", groupCount);
    }
    canExportActive = status.activeIsGroup;
    canExportAll = status.groupCount > 0;
    setBusy(false);
}
async function currentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !String(tab.url || "").startsWith("https://web.whatsapp.com/"))
        return null;
    return tab;
}
async function ensureScripts(tabId) {
    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["inject.js"],
        world: "MAIN",
    });
    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["bridge.js"],
    });
}
function sendOnce(tabId, action) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: "POINT_WA", action }, (response) => {
            if (chrome.runtime.lastError || !response) {
                resolve({
                    ok: false,
                    missing: true,
                    error: "WhatsApp Web is not connected. Reload the page, then try again.",
                });
                return;
            }
            resolve(response);
        });
    });
}
async function send(action) {
    const tab = await currentTab();
    if (!tab?.id) {
        return {
            ok: false,
            wrongPage: true,
            error: "Open WhatsApp Web in this tab, then click the extension icon again.",
        };
    }
    const first = await sendOnce(tab.id, action);
    if (!("missing" in first) || !first.missing)
        return first;
    try {
        await ensureScripts(tab.id);
    }
    catch {
        return { ok: false, error: "The extension could not connect to this tab. Reload WhatsApp Web." };
    }
    return sendOnce(tab.id, action);
}
function renderStats(data) {
    const stats = byId("stats");
    stats.replaceChildren();
    [
        [data.rows.length, data.rows.length === 1 ? "member" : "members"],
        [data.withPhone, "with a number"],
        [data.missingPhones, "hidden"],
    ].forEach(([value, label]) => {
        const box = document.createElement("div");
        box.className = "stat";
        const number = document.createElement("b");
        number.textContent = String(value);
        const caption = document.createElement("span");
        caption.textContent = label;
        box.append(number, caption);
        stats.append(box);
    });
}
function visibleRows() {
    const query = byId("query").value.trim().toLowerCase();
    const rows = exportData?.rows ?? [];
    if (!query)
        return rows;
    return rows.filter((row) => [row.name, row.pushname, row.phone, row.role, row.group].join(" ").toLowerCase().includes(query));
}
function renderTable() {
    const rows = visibleRows();
    const body = byId("rows");
    body.replaceChildren();
    rows.slice(0, PREVIEW_LIMIT).forEach((row) => {
        const tr = document.createElement("tr");
        const name = document.createElement("td");
        name.textContent = row.name;
        const phone = document.createElement("td");
        phone.textContent = row.phone || "—";
        const roleCell = document.createElement("td");
        const role = document.createElement("span");
        role.className = `role ${row.role.toLowerCase()}`;
        role.textContent = row.role;
        roleCell.append(role);
        const group = document.createElement("td");
        group.textContent = row.group;
        tr.append(name, phone, roleCell, group);
        body.append(tr);
    });
    const note = byId("preview-note");
    const shown = Math.min(rows.length, PREVIEW_LIMIT);
    if (!rows.length)
        note.textContent = "No matching rows.";
    else if (rows.length > shown) {
        note.textContent = `Showing ${shown} of ${rows.length} rows. The download still includes every row.`;
    }
    else
        note.textContent = `${rows.length} ${rows.length === 1 ? "row" : "rows"}.`;
}
function renderResult(data) {
    byId("result").hidden = false;
    renderStats(data);
    const warning = byId("warning");
    const notes = [];
    if (data.missingPhones) {
        notes.push(`${data.missingPhones} members have no visible number. WhatsApp hides numbers that are not in your contacts.`);
    }
    if (data.failures?.length) {
        notes.push(`${data.failures.length} ${data.failures.length === 1 ? "group is" : "groups are"} incomplete. Open each group until its member list appears, then export again.`);
    }
    warning.hidden = notes.length === 0;
    warning.textContent = notes.join(" ");
    byId("query").value = "";
    renderTable();
}
async function refresh() {
    clearError();
    exportData = null;
    byId("result").hidden = true;
    byId("progress").hidden = true;
    showGate("Reading WhatsApp Web…", false, true);
    const response = await send("status");
    if (!response.ok) {
        showGate(response.wrongPage ? "Open https://web.whatsapp.com and sign in." : response.error || "WhatsApp Web is not ready.", !response.wrongPage);
        return;
    }
    if (!isStatus(response)) {
        showGate("WhatsApp Web is not ready.", true);
        return;
    }
    showWorkspace(response);
}
async function runExport(action) {
    clearError();
    setBusy(true);
    byId("result").hidden = true;
    byId("progress").hidden = false;
    byId("bar").style.width = action === "all" ? "6%" : "45%";
    byId("progress-text").textContent = action === "all" ? "Preparing every group…" : "Reading group members…";
    const response = await send(action);
    byId("progress").hidden = true;
    if (!response.ok) {
        setBusy(false);
        showError(response.error || "Could not export the group members.");
        return;
    }
    if (!isExport(response) || !response.rows.length) {
        setBusy(false);
        showError("No members were found. Open the group info, wait for the list, then try again.");
        return;
    }
    exportData = response;
    setBusy(false);
    renderResult(response);
}
function download(filename, type, content) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function copyPhones() {
    const label = byId("copy-label");
    const phones = [...new Set((exportData?.rows ?? []).map((row) => row.phone).filter(Boolean))];
    if (!phones.length) {
        label.textContent = "No numbers";
        setTimeout(() => {
            label.textContent = "Copy numbers";
        }, 1400);
        return;
    }
    const text = phones.join("\n");
    try {
        await navigator.clipboard.writeText(text);
    }
    catch {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.append(area);
        area.select();
        document.execCommand("copy");
        area.remove();
    }
    label.textContent = `${phones.length} copied`;
    setTimeout(() => {
        label.textContent = "Copy numbers";
    }, 1400);
}
chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "POINT_WA_PROGRESS")
        return;
    const total = message.total || 1;
    const current = message.current || 0;
    const ratio = Math.max(6, Math.round((current / total) * 100));
    byId("bar").style.width = `${ratio}%`;
    byId("progress-text").textContent = `Reading ${current} of ${message.total}: ${message.title ?? ""}`;
});
byId("btn-active").addEventListener("click", () => void runExport("active"));
byId("btn-all").addEventListener("click", () => void runExport("all"));
byId("btn-retry").addEventListener("click", () => void refresh());
byId("query").addEventListener("input", renderTable);
byId("btn-xls").addEventListener("click", () => {
    if (!exportData)
        return;
    download(`${baseName(exportData.rows, exportData.mode)}.xls`, "application/vnd.ms-excel", toXls(exportData.rows));
});
byId("btn-csv").addEventListener("click", () => {
    if (!exportData)
        return;
    download(`${baseName(exportData.rows, exportData.mode)}.csv`, "text/csv;charset=utf-8", toCsv(exportData.rows));
});
byId("btn-vcf").addEventListener("click", () => {
    if (!exportData)
        return;
    const content = toVcf(exportData.rows);
    if (!content.trim()) {
        showError("A vCard needs phone numbers, and none were found.");
        return;
    }
    download(`${baseName(exportData.rows, exportData.mode)}.vcf`, "text/vcard", content);
});
byId("btn-copy").addEventListener("click", () => void copyPhones());
void refresh();
