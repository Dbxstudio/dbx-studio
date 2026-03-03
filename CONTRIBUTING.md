# Contributing to DBX Studio

First off, thank you for considering contributing to DBX Studio! It's people like you that make DBX Studio such a great tool.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

## Tech Stack

Before diving in, here are the core technologies we use:
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Monorepo Tool**: [Turborepo](https://turbo.build/repo)
- **Backend Environment**: [Bun](https://bun.sh/)
- **Frontend Framework**: [React](https://react.dev/) / [Vite](https://vitejs.dev/)
- **Database ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Testing**: [Playwright](https://playwright.dev/)

## Setting up your local environment

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/dbx-studio.git
   cd dbx-studio
   ```
3. **Install dependencies**. We use `pnpm` workspace, so simply run:
   ```bash
   pnpm install
   ```
4. **Set up `.env` files**. Walk through `SETUP_CREDENTIALS.md` if any specific keys are required locally, or copy `.env.example` configurations to `.env`.

## Running the application

To start the development servers for both the frontend (web) and backend (api) simultaneously:

```bash
pnpm run dev
```
*(Alternatively, you can run them via Docker. See `README.md` for Docker instructions)*

## How to Contribute

### 1. Reporting Bugs
- Make sure you are on the latest version and the bug has not already been reported by searching the issues.
- Use the **Bug Report** issue template when opening a new issue.
- Include as much context as possible (OS, steps to reproduce, logs, etc.).

### 2. Suggesting Enhancements
- If you have an idea for a new feature or improvement, check the issue tracker to see if it's already being discussed.
- Use the **Feature Request** issue template.
- Explain *why* this enhancement would be useful to most DBX Studio users.

### 3. Pull Requests
The process described here has several goals:
- Maintain DBX Studio's quality.
- Fix problems that are important to users.
- Engage the community in working toward the best possible open source database management and AI client.

**Steps to PR:**
1. **Create a new branch** for your feature or fix: `git checkout -b feature/your-feature-name` or `fix/issue-description`
2. **Write your code** and ensure it aligns with the existing code style.
3. **Add tests** if applicable using Playwright.
4. **Run tests & linters** locally to make sure everything passes.
5. **Commit your changes**: Make sure your commit messages are descriptive.
6. **Push to your fork** and submit a **Pull Request** to the `main` branch.
7. Fill out the PR template thoroughly.

## Code of Conduct

By participating in this project, you are expected to uphold general open-source community standards (be welcoming, patient, respectful, and collaborative!).

Thank you for contributing! 🚀
