//! CRSP POS desktop shell.
//!
//! What it adds on top of the browser:
//!   * a kiosk / full-screen window that cannot be closed by accident
//!   * direct printing: raw ESC/POS over LAN (TCP 9100) and over serial ports, no separate print bridge needed
//! The cashier UI is still the same web app; set CRSP_URL to where it is served (default http://localhost:3010/start).
//!
//! NOTE: written against the Tauri 2 API but NOT compiled in the environment it was authored in (no Rust toolchain there).
//! First build: `cargo tauri icon public/brand/icon-512.png` then `npm run desktop:dev`. Fix any API drift the compiler reports.

use base64::{engine::general_purpose::STANDARD, Engine};
use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;
use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Send raw bytes to a LAN printer (port 9100). `data_b64` is the ESC/POS job, base64 encoded.
#[tauri::command]
fn print_raw(host: String, port: u16, data_b64: String) -> Result<(), String> {
    let bytes = STANDARD.decode(data_b64).map_err(|e| format!("bad data: {e}"))?;
    let addr = (host.as_str(), port)
        .to_socket_addrs()
        .map_err(|e| format!("bad address: {e}"))?
        .next()
        .ok_or("printer address not found")?;
    let mut s = TcpStream::connect_timeout(&addr, Duration::from_secs(3)).map_err(|e| format!("cannot reach printer: {e}"))?;
    s.set_write_timeout(Some(Duration::from_secs(5))).ok();
    s.write_all(&bytes).map_err(|e| format!("write failed: {e}"))?;
    s.flush().map_err(|e| e.to_string())
}

/// Send raw bytes to a serial / virtual-COM / Bluetooth-serial printer.
#[tauri::command]
fn print_serial(port: String, baud: u32, data_b64: String) -> Result<(), String> {
    let bytes = STANDARD.decode(data_b64).map_err(|e| format!("bad data: {e}"))?;
    let mut p = serialport::new(port, baud).timeout(Duration::from_secs(3)).open().map_err(|e| format!("cannot open port: {e}"))?;
    p.write_all(&bytes).map_err(|e| format!("write failed: {e}"))
}

/// Names of serial ports on this PC (helps the owner pick the printer's COM port).
#[tauri::command]
fn serial_ports() -> Vec<String> {
    serialport::available_ports().map(|v| v.into_iter().map(|p| p.port_name).collect()).unwrap_or_default()
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![print_raw, print_serial, serial_ports])
        .setup(|app| {
            let url = std::env::var("CRSP_URL").unwrap_or_else(|_| "http://localhost:3010/start".into());
            let kiosk = std::env::var("CRSP_KIOSK").map(|v| v != "0").unwrap_or(true);
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse().map_err(|e| format!("bad CRSP_URL: {e}"))?))
                .title("CRSP POS")
                .fullscreen(kiosk)
                .inner_size(1366.0, 768.0)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CRSP POS");
}
