# Netra Core

**Netra Core** is a lightweight, cross-platform desktop application designed to provide a secure, encrypted DNS tunnel while offering real-time network capacity benchmarking. It leverages Cloudflare's public infrastructure for high-accuracy speed tests without the need for accounts or rate limits.

![Version](https://img.shields.io/badge/version-1.1.0-accent?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-ISC-green?style=for-the-badge)

## 🚀 Key Features

-   **🔒 Secure DNS Tunneling:** Automatically routes your system DNS through encrypted DoH (DNS over HTTPS) providers.
-   **⚡ Live Capacity Benchmarking:** Measures your actual network capacity (Mbps) with a high-accuracy, multi-sample speed test.
-   **🌍 Cross-Platform:** Native support for Windows, macOS, and Linux with automated system-level DNS management.
-   **📈 Real-time IP Logging:** Monitors and logs DNS queries in real-time to provide visibility into network activity.
-   **🎨 Cyberpunk Aesthetic:** A high-performance, dark-themed UI built for speed and clarity.
-   **🛡️ Privacy First:** No accounts, no tracking, and no rate limits. Results are served directly via global CDNs.

## 📥 Download & Install

The easiest way to use **Netra Core** is to download the pre-built binaries for your operating system.

### 🚀 Get Latest Release
Visit the [GitHub Releases](https://github.com/healer-op/Netra-Core/releases/latest) page to download the latest version:

- **Windows:** Download the `.exe` (Portable or Setup).
- **macOS:** Download the `.dmg` package.
- **Linux:** Download the `.AppImage` (Universal).

---

### 🛠️ Development & Building from Source
If you are a developer and wish to contribute or build Netra yourself:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/healer-op/Netra-Core.git
   cd Netra-Core
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run in development mode:**
   ```bash
   npm start
   ```
4. **Build for production:**
   ```bash
   # Windows
   npm run build:win
   # Linux
   npm run build:linux
   ```
   *Note: macOS builds require a macOS environment.*

## ⚙️ How it Works

1.  **Proxy:** Netra starts a local DNS proxy that translates standard UDP DNS requests into encrypted HTTPS calls.
2.  **DNS Management:**
    *   **Windows:** Uses `netsh` to update interface DNS.
    *   **macOS:** Uses `networksetup` for service-level updates.
    *   **Linux:** Utilizes `resolvectl` (systemd) or `nmcli` (NetworkManager).
3.  **Speed Test:** Performs 3-sample download and 2-sample upload measurements against Cloudflare's edge nodes to calculate true network capacity.

## 🤝 Contribution

Contributions are welcome! Please feel free to submit a Pull Request.

## 📜 License

This project is licensed under the **ISC License**.

---
*Created with ❤️ by HEALER-OP*
