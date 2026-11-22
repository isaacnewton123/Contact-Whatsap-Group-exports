# Contact WhatsApp Group Exports

A Chrome extension that exports members of a WhatsApp Web group to Excel, CSV, or vCard. Names and numbers are processed on your computer. Nothing is uploaded.

The source is TypeScript. Chrome runs the compiled extension in `dist`. This project is open source under the [MIT License](LICENSE).

## Support

- Ko-fi: [ko-fi.com/isaacnewton1](https://ko-fi.com/isaacnewton1)
- Trakteer: [trakteer.id/isaacnewton1/link](https://trakteer.id/isaacnewton1/link)
- GitHub: [github.com/sponsors/isaacnewton123](https://github.com/sponsors/isaacnewton123)

## Build

```powershell
npm install
npm run build
```

Load `dist` from `chrome://extensions` with Developer mode on.

`npm run package` creates `contact-whatsapp-group-exports.zip`. Upload that zip to the Chrome Web Store. The manifest is at the root of the zip.

## Use

1. Open [WhatsApp Web](https://web.whatsapp.com) and sign in.
2. Open a group.
3. Click the extension icon.
4. Choose **Export this group** or **Export all groups**.
5. Download Excel, CSV, or vCard.

Excel keeps phone numbers as text. A vCard can be imported into a phone's contacts, and the same number is written once.

WhatsApp hides some numbers. A blank phone cell means the number was not available, usually because that person is not in your contacts. The name and role are still exported.

## Store listing

Name: **Contact WhatsApp Group Exports**

Summary: Export WhatsApp Web group members to Excel, CSV, or vCard. Everything stays on your computer.

Permissions to explain in the dashboard:

- **activeTab** and **scripting**: read the open WhatsApp Web tab after you click the icon.
- **https://web.whatsapp.com/***: the extension only runs there.

Privacy form: the extension handles names and phone numbers that are already visible in your own WhatsApp Web session. It does not transmit them, sell them, or use them for advertising. It does not send messages or change group membership. A public privacy-policy URL is required before submission because phone numbers are personal data.

The interface icons are Material Symbols, the open-source set used by Google Fonts. They are stored inside the extension. A remote icon CDN would be rejected as remote code.

## Privacy policy

Contact WhatsApp Group Exports reads group member names, roles, and phone numbers from WhatsApp Web only after you click Export. The file is created on your device. The extension has no server, does not send the list anywhere, and does not collect analytics. Uninstalling the extension removes its local access. WhatsApp Web itself remains subject to WhatsApp's own terms and privacy policy.
