# Dice Online isolated test preview

The deployment is intentionally **manual** and only runs from `feature/public-rooms-cloudflare`. It deploys to a separate Cloudflare Pages project and the separate `dice-online-public-rooms-test` Worker; it never uses the production Worker config or merges to `main`.

## Prerequisites (one-time)

1. Create a Cloudflare Pages project named `dice-online-test` (or choose another project name when dispatching the workflow) and allow branch preview deployments.
2. Add repository Actions secrets `CF_API_TOKEN` and `CF_ACCOUNT_ID`. The API token needs Cloudflare Pages deployment and Workers deployment/Durable Objects migration permissions for the test account.
3. Confirm the preview branch alias. With the default project name it is expected to be `https://feature-public-rooms-cloudflare.dice-online-test.pages.dev`. Use the exact origin (no trailing slash) as the workflow input; do not assume it if Cloudflare shows a different alias.

## Deploy

On GitHub, open **Actions → Deploy isolated Dice Online test preview → Run workflow**. Select the feature branch, provide the exact Pages preview origin and project name, and run it. The workflow is gated to the feature branch and `workflow_dispatch`; pushes and pull requests do not deploy.

The static preview build copies the root game assets into a separate directory, injects a prominent **TEST PREVIEW — NOT PRODUCTION** banner, and defaults its public-room API to the isolated test Worker. The source `index.html` is not edited by the build. The test Worker is configured to accept the supplied preview origin.

After a successful run, Cloudflare Pages will show the branch-preview URL. Open it in two browser sessions to test Host and Quick Match Guest. The live production site and `main` remain untouched.

If secrets or the Pages project are missing, the deployment job fails before a usable test URL is created; this workflow does not create or alter the production project.
