// @ts-check
import { defineConfig } from "astro/config";

const isGitHubPages = process.env.DEPLOY_TARGET === "github-pages";
const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "BontrWebsite";
const githubOwner = process.env.GITHUB_REPOSITORY_OWNER ?? "CadenGudenkauf";

export default defineConfig({
  output: "static",
  site: isGitHubPages
    ? `https://${githubOwner.toLowerCase()}.github.io`
    : process.env.SITE_URL,
  base: isGitHubPages ? `/${repositoryName}` : "/",
  vite: {
    build: {
      target: "es2022",
    },
  },
});
