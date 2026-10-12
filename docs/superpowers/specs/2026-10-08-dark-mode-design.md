# Dark Mode (default dark)

## Goal

Add a light/dark/system theme toggle to the backoffice, defaulting new visitors to dark mode. Most of the groundwork already exists in the repo:

- `src/app/globals.css` already defines full `:root` (light) and `.dark` CSS variable sets, with a class-based dark variant: `@custom-variant dark (&:is(.dark *));`.
- `dark:` Tailwind variants are already used throughout the generated shadcn components (button, input, badge, dropdown-menu, select, etc.) — they just need the `.dark` class to actually be applied somewhere in the tree.
- `next-themes` (`^0.4.6`) is already a `package.json` dependency and is already imported by `src/components/ui/sonner.tsx` (`useTheme()`), but there is no `ThemeProvider` anywhere in the tree yet, so that call currently falls back to its static default.

What's missing is: mounting `next-themes`' `ThemeProvider`, the hydration-safety attribute it requires, and a UI control to change the theme.

## Non-goals

- No new settings/preferences page.
- No change to `stores/ui-store.ts` — theme state lives in `next-themes` only, not duplicated into Zustand, to avoid two sources of truth drifting out of sync.
- No changes to `globals.css`, `components.json`, or existing shadcn component files — their `dark:` classes already work correctly once `.dark` is toggled on an ancestor.

## Architecture

1. **`src/app/providers.tsx`** — wrap the existing provider tree with `ThemeProvider` from `next-themes`:
   ```tsx
   <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
     {/* existing QueryClientProvider + Toaster tree */}
   </ThemeProvider>
   ```
   - `attribute="class"` matches the existing class-based dark variant in `globals.css`.
   - `defaultTheme="dark"` — first-time visitors with no stored preference get dark mode.
   - `enableSystem` keeps "system" available as an explicit, opt-in choice (not the default) per the three-state toggle below.

2. **`src/app/layout.tsx`** — add `suppressHydrationWarning` to the `<html>` element. This is required by `next-themes` because it sets the `class` attribute on `<html>` before React hydrates (to avoid a flash of incorrect theme), which would otherwise produce a hydration mismatch warning.

## Toggle component

New file: `src/components/layout/theme-toggle.tsx`.

- A small dropdown scoped only to theme selection, built on the existing `src/components/ui/dropdown-menu.tsx` primitive (Base UI based, already in the codebase) — not a general user-account menu.
- Trigger: `<Button variant="outline" size="icon">` rendering a `lucide-react` icon (`Sun` / `Moon`) reflecting the *resolved* theme (`useTheme().resolvedTheme`), so that under "system" the icon still shows the actual active appearance rather than a generic icon.
- Menu content: three `DropdownMenuItem`s — Light, Dark, System — each calling `setTheme(...)` from `next-themes`' `useTheme()`. The item matching the current `theme` value is visually marked as selected (e.g. a checkmark, consistent with existing dropdown-menu item patterns in the codebase).

## Integration point

`src/components/layout/topbar.tsx`:
- Import `ThemeToggle` and render it immediately to the left of the existing "Sign out" `Button`.
- No other logic in `topbar.tsx` changes — `handleSignOut`, the "Signed in as" label, and the mutation/query hooks are untouched.

## Testing

No new automated test is added. This is a client-only UI toggle with no business logic warranting a unit test, and the repo's Playwright E2E suite is scoped to authenticated backend flows, not visual theming. Verification is manual:

- Start `yarn dev`, load the app in a browser with no prior `theme` localStorage value — confirm it renders in dark mode by default.
- Toggle through Light / Dark / System via the new control — confirm the `.dark` class and visual appearance update correctly for each, and that "system" tracks the OS preference.
- Reload the page — confirm the chosen theme persists (via `next-themes`' own localStorage persistence, key `theme`) and there is no flash of the wrong theme on load.
