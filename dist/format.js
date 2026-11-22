const COLUMNS = [
    ["group", "Group"],
    ["name", "Name"],
    ["pushname", "WhatsApp name"],
    ["phone", "Phone"],
    ["role", "Role"],
    ["waId", "WhatsApp ID"],
];
function cleanFilePart(value) {
    const cleaned = value
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
    return cleaned || "whatsapp-group";
}
function stamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
export function baseName(rows, mode) {
    const groupName = mode === "active" && rows[0] ? cleanFilePart(rows[0].group) : "all-groups";
    return `contacts-${groupName}-${stamp()}`;
}
function csvCell(value) {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
}
export function toCsv(rows) {
    const header = COLUMNS.map(([, label]) => csvCell(label)).join(",");
    const body = rows.map((row) => COLUMNS.map(([key]) => csvCell(row[key])).join(","));
    return `\uFEFFsep=,\r\n${[header, ...body].join("\r\n")}\r\n`;
}
function xmlText(value) {
    return value
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
export function toXls(rows) {
    const header = COLUMNS.map(([, label]) => `<Cell><Data ss:Type="String">${xmlText(label)}</Data></Cell>`).join("");
    const body = rows
        .map((row) => {
        const cells = COLUMNS.map(([key]) => `<Cell><Data ss:Type="String">${xmlText(row[key])}</Data></Cell>`).join("");
        return `<Row>${cells}</Row>`;
    })
        .join("");
    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Contacts">
<Table>
<Row>${header}</Row>
${body}
</Table>
</Worksheet>
</Workbook>`;
}
function vcardEscape(value) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}
export function toVcf(rows) {
    const byPhone = new Map();
    rows.forEach((row) => {
        if (!row.phone)
            return;
        const current = byPhone.get(row.phone) ?? { name: "", phone: row.phone, groups: [] };
        if ((!current.name || current.name === "Unnamed") && row.name && row.name !== "Unnamed") {
            current.name = row.name;
        }
        if (row.group && !current.groups.includes(row.group))
            current.groups.push(row.group);
        byPhone.set(row.phone, current);
    });
    const cards = [...byPhone.values()].map((row) => {
        const name = row.name || row.phone;
        return [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `FN:${vcardEscape(name)}`,
            `N:${vcardEscape(name)};;;;`,
            `TEL;TYPE=CELL:${row.phone}`,
            row.groups.length ? `NOTE:${vcardEscape(`WhatsApp group: ${row.groups.join(", ")}`)}` : "",
            "END:VCARD",
        ]
            .filter(Boolean)
            .join("\r\n");
    });
    return cards.join("\r\n") + (cards.length ? "\r\n" : "");
}
