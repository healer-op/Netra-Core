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

## 🛠️ Installation & Setup

### Prerequisites
-   [Node.js](https://nodejs.org/) (v16 or higher recommended)
-   [npm](https://www.npmjs.com/)

### Clone & Install
```bash
git clone https://github.com/healer-op/Netra-Core.git
cd Netra-Core
npm install
```

### Run in Development
```bash
npm start
```

## 📦 Building for Production

Netra uses `electron-builder` for optimized, small-footprint production builds.

### 🏗️ Local Builds (Windows/Linux only on Windows)
| Command | Target | Output Format |
| :--- | :--- | :--- |
| `npm run build:win` | Windows | Portable (.exe) |
| `npm run build:linux` | Linux | AppImage |
| `npm run build:local` | Win + Linux | Both formats |

> **Note:** macOS builds require a macOS environment and cannot be performed natively on Windows.

### 🚀 Automated Multi-Platform Builds (Recommended)
This project is configured with **GitHub Actions**. To build for **Windows, macOS, and Linux** simultaneously:
1. Push your changes to the `main` branch.
2. Go to the **Actions** tab on your GitHub repository.
3. The "Build/Release" workflow will automatically build all versions.
4. If you push a tag starting with `v` (e.g., `v1.1.0`), it will also create a **GitHub Release** with the binaries attached.

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
