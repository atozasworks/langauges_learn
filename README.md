# AtoZ Services - LAN Learn

[![Build](https://img.shields.io/github/actions/workflow/status/YOUR_GITHUB_USERNAME/YOUR_REPO/ci.yml?branch=main&label=build)](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Version](https://img.shields.io/github/v/release/YOUR_GITHUB_USERNAME/YOUR_REPO?label=version)](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO/releases)

A lightweight, browser-first language learning application focused on dialogue practice, learner management, and multilingual accessibility.

## Project Overview

`LAN Learn` is part of the AtoZ Services ecosystem. It helps learners practice real-world conversations through a clean, responsive interface and supports multi-language UI translation for broader accessibility.

The app runs as a static web project (HTML/CSS/JS) and can optionally be served locally with Node.js tooling.

## Key Features

- Learner profile management with browser persistence
- Dialogue-based language practice experience
- Multi-language interface translation support
- Responsive UI for desktop and mobile devices
- Lightweight architecture with no mandatory backend
- Optional local development server for smoother testing

## Screenshots / Demo

Add your visuals here:

- `docs/screenshots/home.png` - Home / learner selection
- `docs/screenshots/dialogue.png` - Dialogue practice screen
- `docs/screenshots/mobile.png` - Mobile responsive view

Optional demo links:

- Live Demo: `https://your-demo-url.com`
- Demo Video: `https://your-video-url.com`

## Installation

### Prerequisites

- Node.js 14+ (only needed for local serving utilities)
- npm
- Modern browser (Chrome, Edge, Firefox, Safari)

### Steps

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git
cd YOUR_REPO/lan_learn
npm install
```

## Usage

Run with local server:

```bash
npm run serve
```

Or open directly:

1. Navigate to `lan_learn/`
2. Open `index.html` in a browser
3. Add learners and start a dialogue session

## Tech Stack

- HTML5
- CSS3
- JavaScript (ES6+)
- Node.js (dev tooling)
- http-server (local static serving)
- Google Translate integration (client-side)

## Folder Structure

```text
AtoZ_Services/
|-- .github/
|   `-- ISSUE_TEMPLATE/
|       |-- bug_report.md
|       `-- feature_request.md
|-- lan_learn/
|   |-- index.html
|   |-- package.json
|   |-- js/
|   |-- styles/
|   |-- icons/
|   `-- sw.js
|-- .gitignore
|-- CONTRIBUTING.md
|-- LICENSE
`-- README.md
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening issues or pull requests.

Quick start:

1. Fork the repository
2. Create a feature branch
3. Make focused changes with clear commit messages
4. Open a pull request with context and testing notes

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
