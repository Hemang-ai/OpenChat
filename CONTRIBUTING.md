# Contributing to OpenBusinessChat

Thank you for your interest in contributing! This is an open-source project and we welcome all contributions.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/openbusinesschat.git`
3. Follow the setup instructions in the README
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Setup

See [README.md](./README.md) for full setup instructions.

Quick start:
```bash
cp .env.example .env
# Fill in DATABASE_URL and OPENAI_API_KEY
docker-compose up -d postgres
npx prisma migrate dev
npm run dev
```

## Types of Contributions

**Bug fixes** — Open a GitHub issue first, then submit a PR with the fix.

**New features** — Open a discussion or issue to align on the approach before building.

**Documentation** — Always welcome! Fix typos, add examples, improve clarity.

**Integrations** — New LLM providers, file loaders, or knowledge source types.

## Code Standards

- TypeScript strict mode
- No `any` types where avoidable
- Zod validation at all API boundaries
- Prisma for all DB operations
- Follow the existing file structure
- Run `npm run type-check` before submitting

## Pull Request Checklist

- [ ] TypeScript compiles without errors
- [ ] No hardcoded secrets
- [ ] New API routes are protected (admin) or validated (public)
- [ ] Prisma schema changes include a migration
- [ ] Code follows the existing style
- [ ] PR description explains what changed and why

## Issues

Use GitHub Issues for:
- Bug reports (include reproduction steps)
- Feature requests
- Questions about architecture

## License

By contributing, you agree your code will be licensed under the MIT License.
