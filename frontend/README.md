# Frontend

React with Vite and Vitest. Use Node.js 22.13+ (22 LTS) or 24+.

```bash
npm ci
npm start
```

The dev server uses http://localhost:3000. **Rerun `npm ci` after upgrading from the old React Scripts project.** The repository's historical `node_modules` directory is not the source of truth.

- `npm test` runs the interaction tests once.
- `npm run test:watch` watches for test changes.
- `npm run build` generates `build/`.
- `npm run preview` serves that production build locally.
- `npm audit` checks the locked dependency set.

Set `VITE_API_URL` in `.env` to override the API origin. Development defaults to http://localhost:5000; production defaults to `/api` through the supplied same-origin Nginx proxy. Socket.IO follows the same path. Old `REACT_APP_API_URL` settings are no longer used.

See the root [README](../README.md) and [deployment guide](../DEPLOYMENT.md) for database setup, accounts and hosting.
