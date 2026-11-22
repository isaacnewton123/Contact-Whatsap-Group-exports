"use strict";
(() => {
    const page = window;
    if (page.__pointWaBridgeInstalled)
        return;
    page.__pointWaBridgeInstalled = true;
    const SOURCE = "point-wa-export";
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || message.type !== "POINT_WA")
            return false;
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        let settled = false;
        const finish = (payload) => {
            if (settled)
                return;
            settled = true;
            window.removeEventListener("message", onMessage);
            clearTimeout(timer);
            sendResponse(payload);
        };
        const onMessage = (event) => {
            if (event.source !== window)
                return;
            const data = event.data;
            if (!data || data.source !== SOURCE || data.requestId !== requestId)
                return;
            if (data.type === "progress") {
                chrome.runtime
                    .sendMessage({
                    type: "POINT_WA_PROGRESS",
                    requestId,
                    current: data.current,
                    total: data.total,
                    title: data.title,
                })
                    .catch(() => undefined);
                return;
            }
            if (data.type === "result")
                finish(data.payload);
        };
        const timer = setTimeout(() => {
            finish({
                ok: false,
                error: "Reading the groups took too long. Reload WhatsApp Web, then try again.",
            });
        }, 180000);
        window.addEventListener("message", onMessage);
        window.postMessage({
            source: SOURCE,
            type: "request",
            requestId,
            action: message.action,
        }, "*");
        return true;
    });
})();
