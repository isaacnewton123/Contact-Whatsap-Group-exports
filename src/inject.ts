(() => {
  const page = window as Window & {
    require?: (moduleName: string) => unknown;
    webpackChunkwhatsapp_web_client?: { push: (chunk: unknown[]) => unknown };
    webpackChunkbuild?: { push: (chunk: unknown[]) => unknown };
    __pointWaExportInstalled?: boolean;
  };

  if (page.__pointWaExportInstalled) return;
  page.__pointWaExportInstalled = true;

  const SOURCE = "point-wa-export";
  const PHONE_SERVERS = new Set(["c.us", "s.whatsapp.net"]);
  const ROLE_RANK: Record<string, number> = { Owner: 0, Admin: 1, Member: 2 };

  // WhatsApp Web does not publish types for these internal models.
  type WaModel = Record<string, any>;
  type WaRequire = (moduleName: string) => any;

  interface PageMessage {
    source: string;
    type: string;
    requestId?: string;
    action?: string;
    current?: number;
    total?: number;
    title?: string;
    payload?: unknown;
  }

  function post(message: Omit<PageMessage, "source">): void {
    window.postMessage({ source: SOURCE, ...message }, "*");
  }

  function cleanText(value: unknown): string {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tryRequire(requireFn: WaRequire, name: string): any {
    try {
      return requireFn(name);
    } catch {
      return null;
    }
  }

  function resolveRequire(): WaRequire | null {
    if (typeof page.require === "function") return page.require as WaRequire;

    const chunk = page.webpackChunkwhatsapp_web_client || page.webpackChunkbuild;
    if (!chunk || typeof chunk.push !== "function") return null;

    try {
      chunk.push([
        ["point-wa-export"],
        {},
        (requireFn: unknown) => {
          if (typeof requireFn === "function" && typeof page.require !== "function") {
            page.require = requireFn as WaRequire;
          }
        },
      ]);
    } catch {
      return null;
    }

    return typeof page.require === "function" ? (page.require as WaRequire) : null;
  }

  function modelsOf(collection: unknown): WaModel[] {
    if (!collection) return [];
    const record = collection as WaModel;
    if (typeof record.getModelsArray === "function") {
      try {
        const models = record.getModelsArray();
        if (Array.isArray(models)) return models as WaModel[];
      } catch {
        /* try another shape */
      }
    }
    if (Array.isArray(record._models)) return record._models.slice() as WaModel[];
    if (Array.isArray(collection)) return collection.slice() as WaModel[];
    return [];
  }

  function getChatCollection(requireFn: WaRequire): WaModel {
    const collections = tryRequire(requireFn, "WAWebCollections");
    if (collections?.Chat?.getModelsArray || collections?.Chat?._models) {
      return collections.Chat as WaModel;
    }

    const chatModule = tryRequire(requireFn, "WAWebChatCollection");
    const candidates = [
      chatModule?.ChatCollection,
      chatModule?.ChatCollectionImpl,
      chatModule?.default,
    ];
    const found = candidates.find(
      (item) => item && (item.getModelsArray || item._models || item.active),
    );
    if (found) return found as WaModel;

    throw new Error(
      "WhatsApp chat list is not ready. Wait until your chats appear, then try again. Reload the page if it stays empty.",
    );
  }

  function serializeId(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null) {
      const record = value as WaModel;
      if (typeof record._serialized === "string") return record._serialized;
      try {
        if (typeof record.toString === "function") {
          const text = record.toString();
          if (text && text !== "[object Object]") return text;
        }
      } catch {
        /* ignore */
      }
    }
    return "";
  }

  function widParts(value: unknown): { user: string; server: string; serialized: string } | null {
    if (!value) return null;
    if (typeof value === "string") {
      const [userPart, server = ""] = value.split("@");
      return { user: userPart.split(":")[0], server, serialized: value };
    }
    if (typeof value !== "object") return null;

    const record = value as WaModel;
    const serialized = serializeId(value);
    const server = String(
      record.server || (serialized.includes("@") ? serialized.split("@")[1] : ""),
    );
    const user = String(
      record.user || (serialized ? serialized.split("@")[0].split(":")[0] : ""),
    );
    return {
      user,
      server,
      serialized: serialized || (user && server ? `${user}@${server}` : ""),
    };
  }

  function phoneFromWid(value: unknown): string {
    const parts = widParts(value);
    if (!parts || !PHONE_SERVERS.has(parts.server)) return "";
    if (!/^\d{7,15}$/.test(parts.user)) return "";
    return `+${parts.user}`;
  }

  function isGroupChat(chat: WaModel | null): boolean {
    if (!chat) return false;
    const id = serializeId(chat.id || chat.__x_id);
    if (id.endsWith("@newsletter")) return false;
    if (chat.newsletterMetadata || chat.__x_newsletterMetadata) return false;
    if (id.endsWith("@g.us")) return true;
    if (chat.isGroup === true || chat.__x_isGroup === true) return true;
    if (chat.groupMetadata || chat.__x_groupMetadata) return true;
    try {
      if (typeof chat.id?.isGroup === "function" && chat.id.isGroup()) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function chatTitle(chat: WaModel): string {
    const metadata = (chat.groupMetadata || chat.__x_groupMetadata) as WaModel | undefined;
    return (
      cleanText(
        chat.formattedTitle ||
          chat.__x_formattedTitle ||
          chat.name ||
          chat.__x_name ||
          metadata?.subject ||
          metadata?.__x_subject,
      ) || "Untitled group"
    );
  }

  function getActiveChat(chats: WaModel): WaModel | null {
    if (typeof chats.active === "function") {
      try {
        const active = chats.active();
        if (active) return active as WaModel;
      } catch {
        /* ignore */
      }
    }
    return modelsOf(chats).find((chat) => chat.active || chat.__x_active) ?? null;
  }

  function participantModels(metadata: WaModel | null | undefined): WaModel[] {
    if (!metadata) return [];
    return modelsOf(metadata.participants || metadata.__x_participants);
  }

  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]).finally(() => clearTimeout(timer));
  }

  async function ensureMetadata(requireFn: WaRequire, chat: WaModel): Promise<WaModel | null> {
    const current = (chat.groupMetadata || chat.__x_groupMetadata || null) as WaModel | null;
    if (participantModels(current).length > 0) return current;

    const module = tryRequire(requireFn, "WAWebGroupMetadataCollection");
    const store = (module?.default || module?.GroupMetadataCollection) as WaModel | undefined;
    if (!store || typeof store.find !== "function") return current;

    const keys = [chat.id || chat.__x_id, serializeId(chat.id || chat.__x_id)].filter(Boolean);
    for (const key of keys) {
      try {
        const found = await withTimeout(Promise.resolve(store.find(key)), 8000);
        if (found) return found as WaModel;
      } catch {
        /* keep the copy already on the chat */
      }
    }
    return (chat.groupMetadata || chat.__x_groupMetadata || current) as WaModel | null;
  }

  function isTruthy(value: unknown): boolean {
    if (typeof value === "function") {
      try {
        return isTruthy((value as () => unknown)());
      } catch {
        return false;
      }
    }
    return value === true || value === 1 || value === "true";
  }

  function textName(value: unknown): string {
    const text = cleanText(value);
    if (!text) return "";
    if (/^\+?\d[\d\s().-]{6,}$/.test(text)) return "";
    return text;
  }

  function readNames(participant: WaModel): { name: string; pushname: string } {
    const contact = (participant.contact || participant.__x_contact || {}) as WaModel;
    const saved = [
      contact.name,
      contact.__x_name,
      contact.shortName,
      contact.__x_shortName,
      contact.formattedName,
      contact.__x_formattedName,
      contact.verifiedName,
      contact.__x_verifiedName,
    ]
      .map(textName)
      .find(Boolean);

    const pushname = textName(
      contact.pushname ||
        contact.__x_pushname ||
        contact.notifyName ||
        contact.__x_notifyName ||
        participant.notifyName ||
        participant.__x_notifyName,
    );

    return {
      name: saved || pushname || "Unnamed",
      pushname,
    };
  }

  function roleOf(participant: WaModel): string {
    if (isTruthy(participant.isSuperAdmin) || isTruthy(participant.__x_isSuperAdmin)) return "Owner";
    if (isTruthy(participant.isAdmin) || isTruthy(participant.__x_isAdmin)) return "Admin";
    return "Member";
  }

  async function resolvePhone(requireFn: WaRequire, participant: WaModel): Promise<string> {
    const contact = (participant.contact || participant.__x_contact || {}) as WaModel;
    const direct = [
      participant.phoneNumber,
      participant.__x_phoneNumber,
      contact.phoneNumber,
      contact.__x_phoneNumber,
      contact.id,
      contact.__x_id,
      participant.id,
      participant.__x_id,
    ];

    for (const value of direct) {
      const phone = phoneFromWid(value);
      if (phone) return phone;
    }

    const api = tryRequire(requireFn, "WAWebApiContact");
    if (!api || typeof api.getPhoneNumber !== "function") return "";

    let wid = participant.id || participant.__x_id;
    const parts = widParts(wid);
    if (parts?.server === "lid" && parts.serialized) {
      const converter = tryRequire(requireFn, "WAWebJidToWid");
      if (converter && typeof converter.lidUserJidToUserLid === "function") {
        try {
          wid = converter.lidUserJidToUserLid(parts.serialized) || wid;
        } catch {
          /* keep the original id */
        }
      }
    }

    try {
      const resolved = await api.getPhoneNumber(wid);
      return phoneFromWid(resolved);
    } catch {
      return "";
    }
  }

  async function rowsForChat(
    requireFn: WaRequire,
    chat: WaModel,
  ): Promise<{
    group: { title: string; id: string; participantCount: number };
    rows: Array<Record<string, string>>;
  }> {
    const metadata = await ensureMetadata(requireFn, chat);
    const people = participantModels(metadata);
    const group = chatTitle(chat);
    const groupId = serializeId(chat.id || chat.__x_id);
    const rows = [];

    for (const participant of people) {
      const names = readNames(participant);
      const phone = await resolvePhone(requireFn, participant);
      rows.push({
        group,
        groupId,
        name: names.name,
        pushname: names.pushname,
        phone,
        role: roleOf(participant),
        waId: serializeId(participant.id || participant.__x_id),
      });
    }

    return {
      group: { title: group, id: groupId, participantCount: rows.length },
      rows,
    };
  }

  function listGroups(chats: WaModel): WaModel[] {
    return modelsOf(chats).filter(isGroupChat);
  }

  async function buildStatus(): Promise<Record<string, unknown>> {
    const requireFn = resolveRequire();
    if (!requireFn) {
      return {
        ok: false,
        error:
          "WhatsApp Web is not ready. Wait until your chats appear, then open this popup again. Reload the page if needed.",
      };
    }

    const chats = getChatCollection(requireFn);
    const groups = listGroups(chats);
    const active = getActiveChat(chats);
    const activeIsGroup = isGroupChat(active);
    const activeCount = activeIsGroup
      ? participantModels((active?.groupMetadata || active?.__x_groupMetadata) as WaModel | undefined).length
      : null;

    return {
      ok: true,
      activeTitle: active ? chatTitle(active) : "",
      activeIsGroup,
      activeCount,
      groupCount: groups.length,
    };
  }

  async function buildExport(action: string, requestId: string): Promise<Record<string, unknown>> {
    const requireFn = resolveRequire();
    if (!requireFn) {
      return {
        ok: false,
        error: "WhatsApp Web is not ready. Wait until your chats appear, then try again.",
      };
    }

    const chats = getChatCollection(requireFn);
    const active = getActiveChat(chats);
    const selected = action === "all" ? listGroups(chats) : active ? [active] : [];

    if (action !== "all") {
      if (!active) return { ok: false, error: "No conversation is open." };
      if (!isGroupChat(active)) {
        return { ok: false, error: "The open conversation is not a group. Open the group you want to export." };
      }
    }

    if (!selected.length) return { ok: false, error: "No groups were found on this account." };

    const groups = [];
    const rows: Array<Record<string, string>> = [];
    const failures: string[] = [];

    for (let index = 0; index < selected.length; index += 1) {
      const chat = selected[index];
      const title = chatTitle(chat);
      post({
        type: "progress",
        requestId,
        current: index + 1,
        total: selected.length,
        title,
      });

      try {
        const result = await rowsForChat(requireFn, chat);
        groups.push(result.group);
        rows.push(...result.rows);
        if (!result.rows.length) failures.push(`${title}: member list was not loaded`);
      } catch {
        failures.push(`${title}: could not be read`);
      }

      if (index < selected.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }

    rows.sort(
      (a, b) =>
        a.group.localeCompare(b.group, "en") ||
        (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) ||
        a.name.localeCompare(b.name, "en"),
    );

    const withPhone = rows.filter((row) => row.phone).length;
    return {
      ok: true,
      mode: action === "all" ? "all" : "active",
      groups,
      rows,
      withPhone,
      missingPhones: rows.length - withPhone,
      failures,
    };
  }

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as Partial<PageMessage> | null;
    if (!data || data.source !== SOURCE || data.type !== "request" || !data.requestId) return;

    const requestId = data.requestId;
    const run = data.action === "status" ? buildStatus() : buildExport(data.action || "active", requestId);
    Promise.resolve(run)
      .then((payload) => {
        post({ type: "result", requestId, payload });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not read the group members.";
        post({ type: "result", requestId, payload: { ok: false, error: message } });
      });
  });
})();
