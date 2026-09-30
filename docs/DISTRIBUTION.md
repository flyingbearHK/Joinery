# Joinery distribution

## Bundle identity

The desktop bundle identifier is `app.joinery.modeler`. Confirm ownership and trademark clearance before a public release; changing it after distribution breaks the platform's application identity.

## Local unsigned build

```bash
npm ci
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

## macOS signing and notarization

The release workflow expects these GitHub Actions secrets:

- `APPLE_CERTIFICATE` — base64-encoded Developer ID Application certificate (`.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD` — app-specific password
- `APPLE_TEAM_ID`

The workflow builds a universal Apple binary and lets the Tauri action sign and notarize the DMG/application bundle. These credentials cannot be generated or validated in source control.

## Windows signing

For public Windows distribution, configure the certificate variables supported by Tauri's signing provider or an Azure Trusted Signing command. The CI build verifies Windows compatibility without a certificate; public artifacts should not be published unsigned.

## Updater

1. Generate a Tauri updater signing key offline.
2. Store the private key and password in `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository secrets.
3. Store the public key as the `TAURI_UPDATER_PUBLIC_KEY` repository secret.
4. The release workflow runs `scripts/create-release-config.mjs` to generate the untracked release config from that key and the GitHub repository name.
5. For a local release, copy `src-tauri/tauri.release.conf.example.json`, replace its placeholders, and build with:

```bash
npm run tauri build -- --config src-tauri/tauri.release.conf.json
```

Never commit the private updater key. The application already includes the updater and process plugins; a production endpoint and public key are deliberately omitted from the normal development config so local builds never contact a nonexistent update service.

## Release process

Push a tag in the form `joinery-vX.Y.Z`, matching `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. `.github/workflows/release.yml` creates a draft GitHub release. Review notarization/signing logs and smoke-test every artifact before publishing.
