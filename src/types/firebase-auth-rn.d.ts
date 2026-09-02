// @firebase/auth's package.json declares a top-level "types" condition
// ("./dist/auth-public.d.ts") ahead of its "react-native" condition, so
// TypeScript's package-exports resolution always picks the generic
// (browser-oriented) typings and never sees the React Native-only
// getReactNativePersistence export — even though Metro's *runtime*
// resolution correctly picks the "react-native" condition's JS build, which
// does export it. This augments (not replaces — note the top-level import
// below, required for TS to merge rather than redefine the module) the
// module's types to match what actually ships at runtime. See
// src/lib/firebase.ts for where this is used.
import type { Persistence } from '@firebase/auth';

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
