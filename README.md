# Studia

Studia is a desktop application designed to help students organize their academic responsibilities, manage their schedules, plan study sessions, and understand their academic progress. This is the frontend repository.

## Technology Stack

- **Desktop Framework:** Tauri 2
- **Frontend Framework:** React
- **Language:** TypeScript
- **Bundler:** Vite

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v22+) and **npm**
- **Rust** and **Cargo**
- **C++ Build Tools** (for Windows)

## Installation

Clone the repository and install the Node.js dependencies:

```bash
git clone https://github.com/maajjjoo/studia-frontend.git
cd studia-frontend
npm install
```

## Development

To start the application in development mode with hot-reloading:

```bash
npm run tauri dev
```

This command will compile the Rust backend and start the React development server.

## Building for Production

To build the application for release:

```bash
npm run tauri build
```

The compiled executable will be located in `src-tauri/target/release/bundle/`.
