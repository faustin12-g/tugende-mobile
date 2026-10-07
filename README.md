# React + TypeScript + Vite

## Map setup

The map requires a valid public Mapbox access token. Copy `.env.example` to `.env`,
set `VITE_MAPBOX_TOKEN` to a token with `styles:read` permission, and allow the
app's origin in the token's URL restrictions (for example,
`http://localhost:5174/*`). Restart the Vite dev server after changing `.env`.

Without a valid token, the map displays a configuration message instead of
remaining on the loading indicator.

## Google Places setup

Enable **Maps JavaScript API** and **Places API (New)** in the Google Cloud
project, then set `VITE_GOOGLE_PLACES_KEY` in `.env` to its API key. This key
is delivered to the browser and is public in the built app; restrict it to the
required APIs and, before release, use separate keys with website, Android, and
iOS application restrictions. Destination autocomplete is biased to Kigali
and Rwanda. Selecting a suggestion fetches its address and coordinates, moves
the Mapbox map to it, and adds a destination marker. Restart Vite after changing
`.env`.

## Supabase setup

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` using the
project URL and publishable/anon key from Supabase **Project Settings → API
Keys**. Never put a service-role key in a `VITE_` variable.

For free local development, open Supabase **Authentication → Providers → Phone**
and add a test phone number with a fixed OTP under the phone/SMS testing
settings. Use that exact E.164 number (for Rwanda, `+250...`) and fixed OTP in
the app; test numbers do not send SMS. Real SMS verification requires a
configured SMS provider and may incur charges.

Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor.
It creates the RLS-protected `profiles` table used to save passenger and driver
profiles after phone verification. Restart Vite after changing `.env`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
