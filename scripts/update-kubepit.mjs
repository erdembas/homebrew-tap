import { createHash } from "node:crypto";
import { readFile, writeFile, rename, rm, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assert,
  repository,
  releaseRoot,
  selectRelease,
  publishedAsset,
  compareVersions,
  validateRelease,
  validateUpdaterFeed,
} from "./kubepit-release.mjs";

const redirectHosts = new Set([
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
]);
// Use the token only at api.github.com with redirects disabled. Public asset
// downloads never receive credentials, including their initial GitHub request.
export async function githubReleases(
  page,
  { token = process.env.GH_TOKEN, fetchImpl = fetch } = {},
) {
  assert(Number.isInteger(page) && page >= 1 && page <= 10, "Invalid API page");
  const response = await fetchImpl(
    `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
    },
  );
  assert(response.ok, `Release discovery failed: HTTP ${response.status}`);
  return response.json();
}
export async function publicAsset(
  url,
  { maxBytes = 5 * 1024 * 1024, digestOnly = false, fetchImpl = fetch } = {},
) {
  const initial = new URL(url);
  assert(
    initial.origin === "https://github.com" &&
      initial.pathname.startsWith("/erdembas/kubepit/releases/download/") &&
      !initial.search &&
      !initial.hash &&
      !initial.username &&
      !initial.password,
    "Unexpected asset origin",
  );
  let current = initial;
  const deadline = AbortSignal.timeout(300_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    assert(
      current.protocol === "https:" &&
        redirectHosts.has(current.hostname) &&
        !current.port &&
        !current.username &&
        !current.password,
      "Unsafe asset redirect",
    );
    const response = await fetchImpl(current.href, {
      headers: { Accept: "application/octet-stream" },
      redirect: "manual",
      signal: deadline,
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      assert(location, "Asset redirect has no destination");
      await response.body?.cancel();
      current = new URL(location, current);
      continue;
    }
    assert(
      response.ok && response.body,
      `Asset download failed: HTTP ${response.status}`,
    );
    const chunks = [],
      hash = createHash("sha256");
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      assert(size <= maxBytes, "Asset exceeds its allowed size");
      hash.update(chunk);
      if (!digestOnly) chunks.push(chunk);
    }
    return digestOnly
      ? { size, sha256: hash.digest("hex") }
      : Buffer.concat(chunks);
  }
  throw new Error("Too many asset redirects");
}
export async function updateKubepit({
  root = resolve(fileURLToPath(new URL("..", import.meta.url))),
  discover = githubReleases,
  download = publicAsset,
} = {}) {
  const releases = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await discover(page);
    assert(Array.isArray(batch), "Invalid release API response");
    releases.push(...batch);
    if (batch.length < 100) break;
    assert(page < 10, "Release discovery exceeded its pagination limit");
  }
  const release = selectRelease(releases);
  if (!release) {
    console.log("No complete published Kubepit release yet; nothing changed.");
    return null;
  }
  const metadata = await Promise.all(
    ["release-manifest.json", "SHA256SUMS", "kubepit.rb"].map((name) => {
      const asset = publishedAsset(release, name);
      assert(
        asset.size <= 5 * 1024 * 1024,
        "Release metadata is unexpectedly large",
      );
      return download(asset.browser_download_url, { maxBytes: asset.size });
    }),
  );
  const verified = validateRelease(release, ...metadata);
  if (verified.updater) {
    const asset = verified.updater.published;
    const bytes = await download(asset.browser_download_url, {
      maxBytes: asset.size,
    });
    validateUpdaterFeed(verified.updater, bytes);
  }
  // Hash historical assets lacking GitHub's digest field without executing them.
  for (const asset of verified.binaries.filter((item) => !item.digest)) {
    assert(
      asset.size <= 1024 * 1024 * 1024,
      "Installer exceeds the size limit",
    );
    const actual = await download(asset.browser_download_url, {
      maxBytes: asset.size,
      digestOnly: true,
    });
    assert(
      actual.size === asset.size && actual.sha256 === asset.sha256,
      `Installer checksum mismatch: ${asset.name}`,
    );
  }
  const path = resolve(root, "Casks/kubepit.rb");
  let existing;
  try {
    existing = await readFile(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing) {
    const current = existing
      .toString("utf8")
      .match(/^  version "([^"]+)"$/m)?.[1];
    assert(current, "Existing Kubepit cask has no recognizable version");
    assert(
      compareVersions(verified.version, current) >= 0,
      "Refusing to downgrade the existing cask",
    );
    if (existing.equals(verified.caskBytes)) {
      console.log(`Kubepit ${verified.version} is already current.`);
      return false;
    }
    assert(
      compareVersions(verified.version, current) > 0,
      "Published cask changed without a version change",
    );
  }
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, verified.caskBytes, { flag: "wx", mode: 0o644 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(
    `Updated only Casks/kubepit.rb to ${release.tag_name} (${release.prerelease ? "prerelease" : "stable"}), byte-for-byte from ${releaseRoot}/tag/${release.tag_name}.`,
  );
  return true;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const updated = await updateKubepit();
  if (process.env.GITHUB_OUTPUT && updated !== null)
    await appendFile(process.env.GITHUB_OUTPUT, "verified=true\n");
}
