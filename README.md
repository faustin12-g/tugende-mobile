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

After the ride and parcel migrations, run
[`supabase/trip-tracking-migration.sql`](./supabase/trip-tracking-migration.sql).
This enables assigned-driver trip controls, latest-location-only updates, and
revocable public tracking links. Drivers must allow device location when
starting a trip. Public links show only the route, trip status, and current
driver location; they expire 24 hours after completion. Share links from a
deployed public app URL for viewers outside the driver's local network. Set
`VITE_PUBLIC_APP_URL` to that web app URL when building the native app; web
builds otherwise use the current site origin.

## Native team-testing builds

Capacitor Android and iOS projects are included. Install Node.js, clone the
repository, run `npm ci`, and create your local `.env` from `.env.example`.
The `.env` file is intentionally ignored by Git; native builds bundle its
`VITE_` values into the app, so configure working Supabase, Mapbox, and Places
credentials before building. Use a deployed public web URL for
`VITE_PUBLIC_APP_URL` so shared tracking links work for teammates.

### Android APK

Install Android Studio with Android SDK 36 and its bundled JDK (JDK 17 or
newer). In the project root, run this command on macOS, Linux, or Windows:

```sh
npm run android:apk
```

The installable debug APK is
`android/app/build/outputs/apk/debug/app-debug.apk`. Share that single APK
file with testers; they do not need the source project or a Play Store
release. On their Android devices, testers may need to allow installation
from the app used to open the APK. This debug build is for internal testing,
not store distribution.

### iOS device testing

On a Mac with Xcode, run `npm run ios:sync`, then open
`ios/App/App.xcodeproj` in Xcode, select a simulator or connected iPhone, and
run the `App` target. A simulator build can be tested in the iOS Simulator.
Installing on teammates' physical iPhones requires Apple code signing and
device provisioning. For a small team, use Xcode's development signing with
each device registered; a directly shareable Ad Hoc IPA requires a matching
distribution profile and the testers' device IDs. TestFlight is another
option later, but is not needed for Android APK testing.

For ordinary team testing, share the APK for Android. Do not share `.env`,
signing certificates, provisioning profiles, Android keystores, or debug
keystores. The native platform folders and app icon resources are already
included in the repository.

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
