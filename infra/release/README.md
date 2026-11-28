# INF08 — Immutable pilot preflight

Reuse the [full-stack release chain](../../docs/operations/release-ghcr.md)
rather than creating another release or promotion workflow.

## Local evidence

From the repository root with Docker and Node 24:

```sh
bash infra/release/verify-archive.sh
```

Six synthetic images derive from the existing pinned Node base. A random
fixture SHA and a synthetic repository identity distinguish them from
real releases. The temporary build context contains only the base image
and USER declaration; no application files, secrets or credentials.
No application build, running containers, registry push or signing
occurs. Docker may pull the pinned base if absent.

The rehearsal creates the actual manifest using the existing release CLI,
saves and hashes all six images, and checks their exact config IDs,
component/source/profile labels, nonroot user and platform. It flips a
byte without changing archive length and requires verification failure.
It restores the original byte, removes only its own six random tags,
reloads the archive, and verifies each image. Finally it substitutes a
different fixture component under the admin tag and requires rejection,
then reloads the original archive and verifies all identities again.
The temporary archive and fixture tags are cleaned up on exit; Docker
may retain shared image layers/build cache.

The local test passed in 11.82 seconds with the pinned base already
available. Full-scope tooling CI runs the rehearsal. This is not a real
application build or cryptographic signing result.

## Manual pilot sequence (not automatically dispatched)

1. After this change is merged, select the exact reviewed main commit
   and confirm its latest push CI completed successfully. In GitHub
   Actions open **Full-stack pilot release candidate**, select main and
   enter the full 40-character reviewed SHA into `source_sha`.
   The workflow checks that the supplied SHA, actual GitHub SHA and
   checked-out commit match before any build. If main advances, stop
   and review the newer commit/CI rather than substituting a SHA blindly.
2. Verify the successful package and independent verify jobs. Record
   source SHA, candidate run ID and archive/manifest attestation evidence.
   The artifact expires after seven days.
3. Only with explicit publication authorization, dispatch
   **Publish verified full-stack pilot to GHCR** with the same source
   SHA, candidate run ID and the existing publish confirmation.
   Check six SPDX inventories, six critical vulnerability scans, all
   twelve OCI attestations and the complete signed receipt.
4. Run **Manual signed full-stack staging rehearsal** with the exact
   builder/publisher identities and its explicit confirmation. This is
   a disposable test and does not authorize a VPS deployment.

Before real staging, require recorded evidence of all three successful
runs, verified artifact identities, immutable digests and the approved
environment and recovery gates. If any step fails or an artifact expires,
do not bypass the gate or reuse a partial publication. No automatic
publish, cloud provisioning, DNS or deployment is authorized here.

Production and Beta remain NO_GO.
