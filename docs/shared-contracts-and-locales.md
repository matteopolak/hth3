# Shared contracts, language catalogues, and tokens

## What it is

These packages define the versioned API vocabulary, the English/French interface messages, and the shared visual token values used by web and mobile. The first contract version covers feedback receipts and classification, applicant profiles and résumé extraction, and the participating-employer application loop.

## How it works

`@civicresolve/contracts/v1` exports typed request/response shapes, public receipt, posting, profile, and résumé views, application and feedback statuses, and privacy-conscious outbox events. The event union is versioned independently with `schemaVersion`; event payloads avoid copying resident message text or application answers into analytics. Public request paths are versioned as `/api/v1/…`. The Worker implements the local guest feedback receipt flow and the applicant-confirmed sample application flow; see [Guest civic feedback](guest-feedback.md) and [In-app applications](applications.md).

`@civicresolve/i18n` exports matching `en` and `fr` catalogues and the `translate` helper. It replaces named placeholders as plain text and leaves an unresolved placeholder visible if a value is missing. Compile-time catalogue typing and tests enforce key and placeholder parity; the test suite also retains a long French privacy explanation. `@civicresolve/design-tokens` exports color, spacing, radius, and typography values as immutable TypeScript constants. The web shell’s `applyTokens()` maps its monochrome colors into CSS variables. Native SwiftUI uses a parallel neutral palette in `CivicTheme`; Swift cannot import the TypeScript package at runtime.

## How to change it

Add a new API field or state to the versioned contract and update its producer and consumer together. For incompatible changes, add a new versioned route/package entry instead of silently changing the meaning of an existing field. Every user-facing message needs both translations with the same placeholder names. Keep descriptions of samples explicit in both languages. Add shared token values in `packages/design-tokens/src/index.ts` before styling web screens, and mirror deliberate palette changes in `apps/mobile/ios/CivicResolve/Design/CivicTheme.swift`. Keep status meaning in text and labels when using the neutral palette; color alone does not distinguish a state.

## Configuration

The base API prefix is `/api/v1`. Locale is the explicit `en` or `fr` value carried by the client preference; source text retains its own provenance and is not translated by these catalogues. Design-token values are compile-time constants and require no runtime configuration.

## Dependencies

The contracts and token packages have no runtime dependencies. The language package depends on the contracts package for its locale type. Vitest verifies catalogue parity, and the root pnpm/TypeScript workspace supplies the build and typecheck tools.
