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

The current app uses email OTP because the Supabase Phone provider requires an
SMS provider. In **Authentication → Email → Templates**, make sure the sign-in
email template includes `{{ .Token }}` so the user receives a code accepted by
the app. Supabase's built-in email delivery has rate and recipient limits; for
regular team testing, configure a custom SMTP provider.

Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor.
For a database where the earlier phone-only schema has already been applied,
run [`supabase/email-auth-migration.sql`](./supabase/email-auth-migration.sql)
instead. Both scripts preserve row-level security on `profiles`.

For an existing project, run
[`supabase/ride-offer-migration.sql`](./supabase/ride-offer-migration.sql) to
create or update ride requests and driver bids. It requires the `profiles` table
to already exist. If ride requests return a 404, this migration has not been
applied successfully or the Supabase API schema cache needs a moment to reload.
Refresh the app after the migration completes. Restart Vite after changing `.env`.

After running the profile and ride setup scripts, run
[`supabase/parcel-delivery-migration.sql`](./supabase/parcel-delivery-migration.sql)
for both new and existing projects to enable parcel deliveries and driver bids.
Parcel pickup and recipient contact details are only readable by the sender;
nearby drivers receive pickup/drop-off details and the sender's offer.

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
