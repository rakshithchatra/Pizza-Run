# Store release checklist

The web game is wrapped with Capacitor. `ios/` and `android/` are real native projects.

    npm run ios       # build the web game, sync, open Xcode
    npm run android   # build the web game, sync, open Android Studio

Run `npm run sync` after every web change, or the native apps keep the old build.

## Done
- iOS and Android projects, bundle ID `com.pizzarun.app`, version 1.0 (1), portrait only
- Haptic buzz on a stumble and on a crash
- Icons and launch screens for both platforms, generated from `assets/logo.svg`
- Privacy policy page at `public/privacy.html`, linked from the menu
- iOS export-compliance answer set (no custom encryption)
- iOS build runs in the iPhone 17 Pro simulator: menu, starting a run, swipes

## To do before submitting
- [ ] Confirm the bundle ID. It cannot change after the first upload.
- [ ] Check the name "Pizza Run" is free on both stores, and run a trademark search.
- [ ] Final logo: replace `assets/logo.svg`, then run
      `npx @capacitor/assets generate --iconBackgroundColor '#e23d28' --iconBackgroundColorDark '#e23d28' --splashBackgroundColor '#e23d28' --splashBackgroundColorDark '#e23d28'`
      and delete the `icons/` folder and `public/manifest.webmanifest` it also writes.
- [ ] Privacy policy: add a contact email, host the page, use its URL in both store listings.
- [ ] Apple Developer account ($99/yr): pick the team under Signing in Xcode, then Product > Archive.
- [ ] Google Play account ($25): install Android Studio, create an upload keystore, build a signed .aab.
- [ ] Android has never been built on this Mac (no Android SDK). Build and test it first.
- [ ] Test on a real iPhone and a real Android phone: swipe feel, frame rate, sound, haptics.
- [ ] Store listings: screenshots, description, age rating, data-safety form ("no data collected").

## Before pizza points are worth real pizza
The wallet is saved on the device only and can be edited. Partner rewards need accounts, a server
that validates runs and holds the balance, coupon issuing, and terms reviewed by a lawyer
(both stores have rules for rewards and sweepstakes).
