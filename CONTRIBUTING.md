# Contributing Guide

Thanks for your interest in improving this project. We welcome bug fixes, improvements, and new ideas.

## 1. Getting Started

1. Fork the repository.
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git
   ```
3. Create a branch:
   ```bash
   git checkout -b feature/short-description
   ```
4. Move into the app directory and install dependencies:
   ```bash
   cd lan_learn
   npm install
   ```
5. Run locally:
   ```bash
   npm run serve
   ```

## 2. Code Style Rules

- Keep code readable and modular.
- Use meaningful variable and function names.
- Follow existing naming and file organization patterns.
- Prefer small, focused functions over large blocks.
- Avoid introducing unused dependencies.
- Keep UI responsive and accessible on mobile and desktop.

## 3. Commit Guidelines

- Use clear, descriptive commit messages.
- Keep each commit focused on one logical change.
- Suggested style:
  - `feat: add learner export option`
  - `fix: handle empty dialogue state`
  - `docs: update setup instructions`

## 4. Pull Request Guidelines

1. Rebase or merge latest `main` before opening PR.
2. Ensure your branch builds/runs without errors.
3. Include a concise PR description:
   - What changed
   - Why it changed
   - How it was tested
4. Add screenshots or short recordings for UI changes.
5. Link related issues (for example: `Closes #12`).
6. Keep PRs reviewable; prefer smaller PRs over very large ones.

## 5. Reporting Bugs or Requesting Features

- Use the issue templates in `.github/ISSUE_TEMPLATE/`.
- Provide reproducible steps, expected behavior, and actual behavior.

## 6. Code of Conduct

Be respectful, constructive, and collaborative in all project interactions.
