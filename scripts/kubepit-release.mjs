import { createHash } from "node:crypto";

export const repository = "erdembas/kubepit";
export const releaseRoot = `https://github.com/${repository}/releases`;
const hashPattern = /^[a-f0-9]{64}$/;
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const targets = [
  ["macos", "arm64", "dmg"],
  ["macos", "x64", "dmg"],
  ["linux", "arm64", "AppImage"],
  ["linux", "arm64", "deb"],
  ["linux", "arm64", "rpm"],
  ["linux", "x64", "AppImage"],
  ["linux", "x64", "deb"],
  ["linux", "x64", "rpm"],
  ["windows", "arm64", "nsis"],
  ["windows", "x64", "nsis"],
  ["windows", "x64", "msi"],
];
export const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export function parseVersion(version) {
  const match = typeof version === "string" && version.match(versionPattern);
  assert(match, "Invalid release version");
  const prerelease = match[4]?.split(".") || [];
  assert(
    prerelease.every((part) => !/^0\d+$/.test(part)),
    "Invalid prerelease identifier",
  );
  return { numbers: match.slice(1, 4).map(BigInt), prerelease };
}
export function compareVersions(a, b) {
  const left = parseVersion(a),
    right = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (left.numbers[i] !== right.numbers[i])
      return left.numbers[i] > right.numbers[i] ? 1 : -1;
  }
  if (!left.prerelease.length || !right.prerelease.length)
    return Number(!left.prerelease.length) - Number(!right.prerelease.length);
  for (
    let i = 0;
    i < Math.max(left.prerelease.length, right.prerelease.length);
    i++
  ) {
    const x = left.prerelease[i],
      y = right.prerelease[i];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const xn = /^\d+$/.test(x),
      yn = /^\d+$/.test(y);
    if (xn !== yn) return xn ? -1 : 1;
    return (xn ? BigInt(x) > BigInt(y) : x > y) ? 1 : -1;
  }
  return 0;
}
export function selectRelease(releases) {
  assert(Array.isArray(releases), "Invalid GitHub release list");
  const complete = releases
    .filter((release) => {
      if (
        release.draft ||
        !release.published_at ||
        typeof release.prerelease !== "boolean" ||
        !release.tag_name?.startsWith("v")
      )
        return false;
      try {
        parseVersion(release.tag_name.slice(1));
      } catch {
        return false;
      }
      return ["release-manifest.json", "SHA256SUMS", "kubepit.rb"].every(
        (name) =>
          release.assets?.some(
            (asset) => asset.name === name && asset.state === "uploaded",
          ),
      );
    })
    .sort((a, b) => compareVersions(b.tag_name.slice(1), a.tag_name.slice(1)));
  // A preview must never supersede an available stable cask. A semver suffix
  // remains a preview even if the GitHub release was accidentally marked stable.
  return (
    complete.find(
      (release) =>
        !release.prerelease &&
        !parseVersion(release.tag_name.slice(1)).prerelease.length,
    ) ?? complete[0]
  );
}
export function publishedAsset(release, name) {
  const matches = release.assets.filter((asset) => asset.name === name);
  assert(matches.length === 1, `Missing or duplicate published asset: ${name}`);
  const asset = matches[0];
  assert(
    asset.state === "uploaded" &&
      Number.isSafeInteger(asset.size) &&
      asset.size > 0,
    `Incomplete published asset: ${name}`,
  );
  assert(
    asset.browser_download_url ===
      `${releaseRoot}/download/${release.tag_name}/${name}`,
    `Unexpected published asset URL: ${name}`,
  );
  if (asset.digest != null)
    assert(
      /^sha256:[a-f0-9]{64}$/.test(asset.digest),
      `Invalid asset digest: ${name}`,
    );
  return asset;
}
export function validateDownloaded(asset, bytes) {
  assert(
    bytes.length === asset.size,
    `Downloaded size mismatch: ${asset.name}`,
  );
  if (asset.digest)
    assert(
      asset.digest === `sha256:${sha256(bytes)}`,
      `Downloaded checksum mismatch: ${asset.name}`,
    );
}
export function parseChecksums(bytes) {
  const result = new Map();
  for (const line of bytes.toString("utf8").trimEnd().split("\n")) {
    const match = line.match(/^([a-f0-9]{64})  ([A-Za-z0-9_.-]+)$/);
    assert(
      match && !result.has(match[2]),
      "Malformed or duplicate SHA256SUMS entry",
    );
    result.set(match[2], match[1]);
  }
  return result;
}
// These are the only updater additions allowed alongside the 11 installers.
export function updaterEntries(version) {
  parseVersion(version);
  return [
    ["macos", "arm64", "app.tar.gz"],
    ["macos", "x64", "app.tar.gz"],
    ["linux", "arm64", "AppImage"],
    ["linux", "arm64", "deb"],
    ["linux", "arm64", "rpm"],
    ["linux", "x64", "AppImage"],
    ["linux", "x64", "deb"],
    ["linux", "x64", "rpm"],
    ["windows", "arm64", "nsis"],
    ["windows", "x64", "nsis"],
    ["windows", "x64", "msi"],
  ].map(([platform, arch, format]) => {
    const base = `${platform === "macos" ? "darwin" : platform}-${arch === "arm64" ? "aarch64" : "x86_64"}`;
    return {
      target: `${platform}-${arch}`,
      platform,
      arch,
      format,
      name: `Kubepit_${version}_${platform}_${arch}${format === "nsis" ? "-setup.exe" : `.${format}`}`,
      platformKeys:
        platform === "windows"
          ? format === "nsis"
            ? [base, `${base}-nsis`]
            : [`${base}-msi`]
          : platform === "linux" && format !== "AppImage"
            ? [`${base}-${format}`]
            : [base],
    };
  });
}
export function validateUpdaterFeed(updater, bytes) {
  validateDownloaded(updater.published, bytes);
  assert(sha256(bytes) === updater.sha256, "Updater feed checksum mismatch");
  const actual = JSON.parse(bytes.toString("utf8"));
  const expected = updater.expected;
  assert(
    actual.version === expected.version &&
      actual.pub_date === expected.pub_date &&
      actual.notes === expected.notes,
    "Updater feed release metadata mismatch",
  );
  assert(
    actual.platforms &&
      Object.keys(actual.platforms).length ===
        Object.keys(expected.platforms).length,
    "Incomplete updater feed platforms",
  );
  for (const [key, entry] of Object.entries(expected.platforms))
    assert(
      actual.platforms[key]?.url === entry.url &&
        actual.platforms[key]?.signature === entry.signature,
      `Updater feed platform mismatch: ${key}`,
    );
}
// Compare this allowlisted template as bytes. A valid hash never authorizes
// arbitrary Ruby, hooks, shell commands or Gatekeeper/quarantine changes.
export function expectedCask(version, mac) {
  return `cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "${version}"
  sha256 arm:   "${mac.arm64.sha256}",
         intel: "${mac.x64.sha256}"

  url "https://github.com/erdembas/kubepit/releases/download/v#{version}/Kubepit_#{version}_macos_#{arch}.dmg",
      verified: "github.com/erdembas/kubepit/"

  name "Kubepit"
  desc "Local-first Kubernetes IDE"
  homepage "https://erdembas.github.io/kubepit/"

  depends_on macos: ">= :big_sur"
  app "Kubepit.app"

  zap trash: [
    "~/Library/Caches/io.github.erdembas.kubepit",
    "~/Library/Preferences/io.github.erdembas.kubepit.plist",
    "~/Library/Saved Application State/io.github.erdembas.kubepit.savedState",
  ]
end
`;
}
export function validateRelease(
  release,
  manifestBytes,
  checksumBytes,
  caskBytes,
) {
  assert(
    !release.draft &&
      release.published_at &&
      typeof release.prerelease === "boolean",
    "Release is not public",
  );
  const version = release.tag_name.slice(1);
  parseVersion(version);
  assert(
    release.tag_name === `v${version}` &&
      release.html_url === `${releaseRoot}/tag/v${version}`,
    "Unexpected release identity",
  );
  for (const [name, bytes] of [
    ["release-manifest.json", manifestBytes],
    ["SHA256SUMS", checksumBytes],
    ["kubepit.rb", caskBytes],
  ])
    validateDownloaded(publishedAsset(release, name), bytes);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert(
    manifest.schemaVersion === 1 &&
      manifest.repository === repository &&
      manifest.version === version &&
      manifest.tag === release.tag_name &&
      manifest.releaseUrl === release.html_url &&
      manifest.prerelease === release.prerelease,
    "Manifest release identity mismatch",
  );
  assert(
    /^[a-f0-9]{40}$/.test(manifest.commit) &&
      /^[a-f0-9]{40}$/.test(manifest.automationCommit),
    "Invalid source provenance",
  );
  assert(
    Number.isFinite(Date.parse(manifest.publishedAt)),
    "Invalid manifest timestamp",
  );
  assert(
    manifest.checksums?.name === "SHA256SUMS" &&
      manifest.checksums.url ===
        `${releaseRoot}/download/${release.tag_name}/SHA256SUMS`,
    "Unexpected checksums URL",
  );
  assert(
    manifest.homebrew?.caskUrl ===
      `${releaseRoot}/download/${release.tag_name}/kubepit.rb` &&
      hashPattern.test(manifest.homebrew.sha256),
    "Unexpected Homebrew metadata",
  );
  assert(
    Array.isArray(manifest.assets) && manifest.assets.length === targets.length,
    "Incomplete installer manifest",
  );
  const sums = parseChecksums(checksumBytes);
  const allowedChecksums = new Set(["kubepit.rb"]);
  const binaries = [],
    mac = {};
  for (const [platform, arch, format] of targets) {
    const name = `Kubepit_${version}_${platform}_${arch}${format === "nsis" ? "-setup.exe" : `.${format}`}`;
    allowedChecksums.add(name);
    const matches = manifest.assets.filter((asset) => asset.name === name);
    assert(
      matches.length === 1,
      `Missing or duplicate manifest asset: ${name}`,
    );
    const asset = matches[0],
      published = publishedAsset(release, name);
    assert(
      asset.platform === platform &&
        asset.arch === arch &&
        asset.format === format &&
        asset.url === published.browser_download_url &&
        asset.size === published.size &&
        hashPattern.test(asset.sha256) &&
        sums.get(name) === asset.sha256,
      `Installer metadata mismatch: ${name}`,
    );
    const signing =
      platform === "macos"
        ? ["ad-hoc", "signed", "notarized"]
        : platform === "windows"
          ? ["unsigned", "signed"]
          : ["unsigned"];
    assert(signing.includes(asset.signing), `Invalid signing state: ${name}`);
    if (published.digest)
      assert(
        published.digest === `sha256:${asset.sha256}`,
        `Published checksum mismatch: ${name}`,
      );
    binaries.push({ ...published, sha256: asset.sha256 });
    if (platform === "macos") mac[arch] = asset;
  }
  let updater;
  if (manifest.updater !== undefined) {
    const metadata = manifest.updater;
    assert(
      metadata?.schemaVersion === 1 &&
        typeof metadata.publicKey === "string" &&
        metadata.publicKey.length > 0 &&
        metadata.publicKey.length <= 4096 &&
        /^[A-Za-z0-9+/]+={0,2}$/.test(metadata.publicKey) &&
        Buffer.from(metadata.publicKey, "base64").toString("base64") ===
          metadata.publicKey,
      "Invalid updater metadata",
    );
    const expected = updaterEntries(version);
    assert(
      Array.isArray(metadata.artifacts) &&
        metadata.artifacts.length === expected.length,
      "Incomplete updater artifact set",
    );
    assert(
      typeof manifest.releaseNotes === "string" &&
        manifest.releaseNotes.trim().length > 0 &&
        Buffer.byteLength(manifest.releaseNotes) <= 64 * 1024,
      "Invalid updater release notes",
    );
    const checkAsset = (asset, name) => {
      const published = publishedAsset(release, name);
      assert(
        asset?.name === name &&
          asset.url === published.browser_download_url &&
          asset.size === published.size &&
          hashPattern.test(asset.sha256) &&
          sums.get(name) === asset.sha256,
        `Updater asset metadata mismatch: ${name}`,
      );
      if (published.digest)
        assert(
          published.digest === `sha256:${asset.sha256}`,
          `Published updater checksum mismatch: ${name}`,
        );
      allowedChecksums.add(name);
      return { ...published, sha256: asset.sha256 };
    };
    const platforms = {};
    for (const entry of expected) {
      const matches = metadata.artifacts.filter(
        (asset) => asset.name === entry.name,
      );
      assert(
        matches.length === 1,
        `Missing or duplicate updater artifact: ${entry.name}`,
      );
      const artifact = matches[0];
      for (const field of ["target", "platform", "arch", "format"])
        assert(
          artifact[field] === entry[field],
          `Updater target mismatch: ${entry.name}`,
        );
      assert(
        JSON.stringify(artifact.platformKeys) ===
          JSON.stringify(entry.platformKeys),
        "Updater platform keys mismatch",
      );
      const payload = checkAsset(artifact, entry.name);
      const existing = binaries.find((asset) => asset.name === entry.name);
      if (existing)
        assert(
          existing.sha256 === payload.sha256 && existing.size === payload.size,
          "Updater and installer disagree",
        );
      else binaries.push(payload);
      const signature = checkAsset(artifact.signature, `${entry.name}.sig`);
      const content = artifact.signature.content;
      assert(
        typeof content === "string" &&
          content.length > 0 &&
          content.length <= 16384 &&
          /^[A-Za-z0-9+/]+={0,2}$/.test(content) &&
          Buffer.from(content, "base64").toString("base64") === content &&
          Buffer.byteLength(content) === signature.size &&
          sha256(content) === signature.sha256,
        "Updater signature content mismatch",
      );
      binaries.push(signature);
      for (const key of entry.platformKeys)
        platforms[key] = { url: artifact.url, signature: content };
    }
    const published = checkAsset(metadata.feed, "latest.json");
    assert(
      published.size <= 1024 * 1024,
      "Updater feed exceeds the size limit",
    );
    updater = {
      published,
      sha256: published.sha256,
      expected: {
        version,
        notes: manifest.releaseNotes,
        pub_date: manifest.publishedAt,
        platforms,
      },
    };
  }
  assert(
    sums.size === allowedChecksums.size &&
      [...sums.keys()].every((name) => allowedChecksums.has(name)),
    "Incomplete or unexpected checksum entries",
  );
  const caskHash = sha256(caskBytes);
  assert(
    caskHash === manifest.homebrew.sha256 &&
      caskHash === sums.get("kubepit.rb"),
    "Cask checksum mismatch",
  );
  assert(
    caskBytes.equals(Buffer.from(expectedCask(version, mac))),
    "Cask differs from the allowed template",
  );
  return { version, binaries, caskBytes, updater };
}
