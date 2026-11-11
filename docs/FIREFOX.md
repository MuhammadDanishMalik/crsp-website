# Running the till in Firefox

The till, kitchen screen and admin work in Firefox the same way as in Chrome (Firefox 115 or newer).

## Silent receipt printing (no print dialog)

Chrome uses the `--kiosk-printing` switch. Firefox uses a preference instead:

1. Set the receipt printer as the Windows **default printer** (80 mm paper in its driver).
2. Copy `deploy/firefox-user.js` into the Firefox profile folder and name it `user.js`
   (Windows: `%APPDATA%\Mozilla\Firefox\Profiles\<name>.default-release\`).
3. Close every Firefox window and open it again. Printing now goes straight to the default printer.

Or by hand: open `about:config`, search `print.always_print_silent`, set it to `true`.

## Tips

- Open the till from a bookmark: `https://www.crspofficial.com/order`
- Allow sound for the site (address bar lock icon, Permissions) so the website order alert can ring.
- Use `https://www.crspofficial.com/print-test` to check paper width and print a ruler slip.
