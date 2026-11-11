// Silent receipt printing in Firefox (no print dialog). Copy this file into the Firefox profile folder, then restart Firefox.
//   Windows:  press Win+R, type  %APPDATA%\Mozilla\Firefox\Profiles  and open the folder that ends with .default-release
//   Put this file there with the exact name  user.js
// Also set the receipt printer as the Windows DEFAULT printer (Settings, Printers), paper 80 mm in its driver.
user_pref("print.always_print_silent", true);        // print at once to the default printer, no dialog
user_pref("print.show_print_progress", false);       // no "printing..." window
user_pref("print.print_headerleft", "");             // no page title / date / url on the paper
user_pref("print.print_headercenter", "");
user_pref("print.print_headerright", "");
user_pref("print.print_footerleft", "");
user_pref("print.print_footercenter", "");
user_pref("print.print_footerright", "");
user_pref("print.print_margin_top", "0");
user_pref("print.print_margin_bottom", "0");
user_pref("print.print_margin_left", "0");
user_pref("print.print_margin_right", "0");
user_pref("print.print_bgcolor", false);
user_pref("print.print_bgimages", false);
