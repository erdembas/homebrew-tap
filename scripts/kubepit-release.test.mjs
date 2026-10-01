import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  repository,
  releaseRoot,
  sha256,
  expectedCask,
  selectRelease,
  compareVersions,
  parseVersion,
  parseChecksums,
  validateRelease,
  validateUpdaterFeed,
} from "./kubepit-release.mjs";
import {
  publicAsset,
  githubReleases,
  updateKubepit,
} from "./update-kubepit.mjs";

function fixture(version = "0.0.1", prerelease = true, withUpdater = false) {
  const tag = `v${version}`;
  const specs = [
    ["macos", "arm64", "dmg"],
    ["macos", "x64", "dmg"],
    ...["arm64", "x64"].flatMap((arch) =>
      ["AppImage", "deb", "rpm"].map((format) => ["linux", arch, format]),
    ),
    ["windows", "arm64", "nsis"],
    ["windows", "x64", "nsis"],
    ["windows", "x64", "msi"],
  ];
  const files = new Map();
  const assets = specs.map(([platform, arch, format]) => {
    const name = `Kubepit_${version}_${platform}_${arch}${format === "nsis" ? "-setup.exe" : `.${format}`}`;
    const bytes = Buffer.from(`Test fixture only: ${name}`);
    files.set(name, bytes);
    return {
      name,
      platform,
      arch,
      format,
      size: bytes.length,
      sha256: sha256(bytes),
      signing: platform === "macos" ? "ad-hoc" : "unsigned",
      url: `${releaseRoot}/download/${tag}/${name}`,
    };
  });
  const mac = Object.fromEntries(
    assets.filter((a) => a.platform === "macos").map((a) => [a.arch, a]),
  );
  const cask = Buffer.from(expectedCask(version, mac));
  const manifest = {
    schemaVersion: 1,
    repository,
    version,
    tag,
    prerelease,
    commit: "a".repeat(40),
    automationCommit: "b".repeat(40),
    publishedAt: "2026-10-01T00:00:00Z",
    releaseUrl: `${releaseRoot}/tag/${tag}`,
    assets,
    checksums: {
      name: "SHA256SUMS",
      url: `${releaseRoot}/download/${tag}/SHA256SUMS`,
    },
    homebrew: {
      caskUrl: `${releaseRoot}/download/${tag}/kubepit.rb`,
      sha256: sha256(cask),
      tap: null,
      installCommand: null,
    },
  };
  const release = {
    tag_name: tag,
    html_url: manifest.releaseUrl,
    draft: false,
    prerelease,
    published_at: manifest.publishedAt,
    assets: [],
  };
  const result = { files, release, manifest, cask };
  if (withUpdater) {
    const updaterSpecs = [
      ["macos", "arm64", "app.tar.gz", ["darwin-aarch64"]],
      ["macos", "x64", "app.tar.gz", ["darwin-x86_64"]],
      ["linux", "arm64", "AppImage", ["linux-aarch64"]],
      ["linux", "x64", "AppImage", ["linux-x86_64"]],
      ["windows", "arm64", "nsis", ["windows-aarch64", "windows-aarch64-nsis"]],
      ["windows", "x64", "nsis", ["windows-x86_64", "windows-x86_64-nsis"]],
      ["windows", "x64", "msi", ["windows-x86_64-msi"]],
    ];
    const metadata = (name, bytes) => {
      files.set(name, bytes);
      return {
        name,
        size: bytes.length,
        sha256: sha256(bytes),
        url: `${releaseRoot}/download/${tag}/${name}`,
      };
    };
    const artifacts = updaterSpecs.map(
      ([platform, arch, format, platformKeys]) => {
        const name = `Kubepit_${version}_${platform}_${arch}${format === "nsis" ? "-setup.exe" : `.${format}`}`;
        // Only metadata integrity is under test; these are not installable or signed binaries.
        const content = Buffer.from(
          `Test signature metadata: ${name}`,
        ).toString("base64");
        return {
          target: `${platform}-${arch}`,
          platform,
          arch,
          format,
          platformKeys,
          ...metadata(
            name,
            files.get(name) || Buffer.from(`Test updater fixture: ${name}`),
          ),
          signature: {
            ...metadata(`${name}.sig`, Buffer.from(content)),
            content,
          },
        };
      },
    );
    const platforms = Object.fromEntries(
      artifacts.flatMap((artifact) =>
        artifact.platformKeys.map((key) => [
          key,
          { url: artifact.url, signature: artifact.signature.content },
        ]),
      ),
    );
    const feed = Buffer.from(
      JSON.stringify({
        version,
        notes: `Kubepit ${version}: signed desktop update. / İmzalı masaüstü güncellemesi.\n${manifest.releaseUrl}`,
        pub_date: manifest.publishedAt,
        platforms,
      }),
    );
    manifest.updater = {
      schemaVersion: 1,
      publicKey: Buffer.from("Test public key metadata").toString("base64"),
      feed: metadata("latest.json", feed),
      artifacts,
    };
  }
  result.refresh = () => {
    files.set("kubepit.rb", result.cask);
    files.set("release-manifest.json", Buffer.from(JSON.stringify(manifest)));
    const checksumEntries = new Map(assets.map((a) => [a.name, a.sha256]));
    checksumEntries.set("kubepit.rb", manifest.homebrew.sha256);
    if (manifest.updater) {
      for (const asset of [
        manifest.updater.feed,
        ...manifest.updater.artifacts.flatMap((artifact) => [
          artifact,
          artifact.signature,
        ]),
      ])
        checksumEntries.set(asset.name, asset.sha256);
    }
    files.set(
      "SHA256SUMS",
      Buffer.from(
        [...checksumEntries]
          .map(([name, hash]) => `${hash}  ${name}`)
          .join("\n") + "\n",
      ),
    );
    release.assets = [...files].map(([name, bytes]) => ({
      name,
      size: bytes.length,
      state: "uploaded",
      digest: `sha256:${sha256(bytes)}`,
      browser_download_url: `${releaseRoot}/download/${tag}/${name}`,
    }));
  };
  result.refresh();
  return result;
}
const validate = (f) =>
  validateRelease(
    f.release,
    f.files.get("release-manifest.json"),
    f.files.get("SHA256SUMS"),
    f.files.get("kubepit.rb"),
  );
const download =
  (f) =>
  async (url, options = {}) => {
    const bytes = f.files.get(url.split("/").at(-1));
    assert.ok(bytes);
    return options.digestOnly
      ? { size: bytes.length, sha256: sha256(bytes) }
      : bytes;
  };
async function staging(t) {
  const root = await mkdtemp(join(tmpdir(), "kubepit-tap-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "Casks"));
  await writeFile(join(root, "Casks/runhq.rb"), "existing RunHQ cask\n");
  return root;
}

test("accepts complete prerelease with exact cask bytes and both Mac architectures", () => {
  const f = fixture();
  const result = validate(f);
  assert.equal(result.version, "0.0.1");
  assert.equal(result.binaries.length, 11);
  assert.deepEqual(result.caskBytes, f.cask);
});
test("accepts the exact updater extension: 24 files, 22 checksums and nine feed platforms", () => {
  const f = fixture("0.0.2", true, true);
  const result = validate(f);
  assert.equal(f.files.size, 24);
  assert.equal(parseChecksums(f.files.get("SHA256SUMS")).size, 22);
  assert.equal(result.binaries.length, 20);
  assert.equal(Object.keys(result.updater.expected.platforms).length, 9);
  validateUpdaterFeed(result.updater, f.files.get("latest.json"));
});
test("rejects missing, duplicate, foreign, tampered and wrong-platform updater metadata", () => {
  for (const mutate of [
    (f) => {
      f.manifest.updater.artifacts.pop();
    },
    (f) => {
      f.manifest.updater.artifacts[1] = f.manifest.updater.artifacts[0];
    },
    (f) => {
      f.manifest.updater.artifacts[0].target = "linux-arm64";
    },
    (f) => {
      f.manifest.updater.artifacts[0].platformKeys = ["darwin-x86_64"];
    },
    (f) => {
      f.manifest.updater.artifacts[0].name = "unexpected.tar.gz";
    },
    (f) => {
      f.manifest.updater.artifacts[0].url = "https://example.com/payload";
    },
    (f) => {
      f.manifest.updater.artifacts[2].sha256 = "0".repeat(64);
    },
    (f) => {
      f.manifest.updater.artifacts[0].signature.content = "dGFtcGVyZWQ=";
    },
    (f) => {
      f.manifest.updater.artifacts[0].signature.url += "?other=1";
    },
    (f) => {
      f.manifest.updater.feed.url = `${releaseRoot}/download/v9.9.9/latest.json`;
    },
    (f) => {
      f.manifest.updater.publicKey = "not base64";
    },
  ]) {
    const f = fixture("0.0.2", true, true);
    mutate(f);
    f.refresh();
    assert.throws(() => validate(f));
  }
  const f = fixture("0.0.2", true, true);
  f.release.assets = f.release.assets.filter(
    (a) => !a.name.endsWith("arm64.app.tar.gz.sig"),
  );
  assert.throws(() => validate(f), /Missing/);
});
test("rejects extra checksum entries for both historical and updater releases", () => {
  for (const withUpdater of [false, true]) {
    const f = fixture("0.0.2", true, withUpdater);
    const bytes = Buffer.concat([
      f.files.get("SHA256SUMS"),
      Buffer.from(`${"a".repeat(64)}  unrelated.sh\n`),
    ]);
    f.files.set("SHA256SUMS", bytes);
    Object.assign(
      f.release.assets.find((a) => a.name === "SHA256SUMS"),
      { size: bytes.length, digest: `sha256:${sha256(bytes)}` },
    );
    assert.throws(() => validate(f), /unexpected checksum/);
  }
});
test("checksummed updater feed cannot change release or platform mappings", () => {
  for (const mutate of [
    (feed) => {
      feed.version = "9.9.9";
    },
    (feed) => {
      delete feed.platforms["linux-aarch64"];
    },
    (feed) => {
      feed.platforms["windows-x86_64"].url = "https://example.com/fake.exe";
    },
    (feed) => {
      feed.platforms["darwin-aarch64"].signature = "dGFtcGVyZWQ=";
    },
  ]) {
    const f = fixture("0.0.2", true, true);
    const feed = JSON.parse(f.files.get("latest.json"));
    mutate(feed);
    const bytes = Buffer.from(JSON.stringify(feed));
    f.files.set("latest.json", bytes);
    Object.assign(f.manifest.updater.feed, {
      size: bytes.length,
      sha256: sha256(bytes),
    });
    f.refresh();
    const verified = validate(f);
    assert.throws(
      () => validateUpdaterFeed(verified.updater, bytes),
      /Updater feed|updater feed/,
    );
  }
});
test("updater feed is fetched before writing and missing signature digests are streamed", async (t) => {
  const root = await staging(t),
    f = fixture("0.0.2", true, true);
  const signature = f.release.assets.find((asset) =>
    asset.name.endsWith(".sig"),
  );
  delete signature.digest;
  const calls = [];
  const fetchFixture = download(f);
  await updateKubepit({
    root,
    discover: async () => [f.release],
    download: async (url, options) => {
      calls.push({ name: url.split("/").at(-1), ...options });
      return fetchFixture(url, options);
    },
  });
  assert.ok(
    calls.some((call) => call.name === "latest.json" && !call.digestOnly),
  );
  assert.deepEqual(
    calls.filter((call) => call.digestOnly).map((call) => call.name),
    [signature.name],
  );
  assert.deepEqual(await readFile(join(root, "Casks/kubepit.rb")), f.cask);
  assert.equal(
    await readFile(join(root, "Casks/runhq.rb"), "utf8"),
    "existing RunHQ cask\n",
  );
});
test("an invalid updater feed leaves the installed cask unchanged", async (t) => {
  const root = await staging(t),
    f = fixture("0.0.2", true, true);
  const previous = fixture().cask;
  await writeFile(join(root, "Casks/kubepit.rb"), previous);
  const feed = JSON.parse(f.files.get("latest.json"));
  feed.platforms["linux-aarch64"].signature = "dGFtcGVyZWQ=";
  const bytes = Buffer.from(JSON.stringify(feed));
  f.files.set("latest.json", bytes);
  Object.assign(f.manifest.updater.feed, {
    size: bytes.length,
    sha256: sha256(bytes),
  });
  f.refresh();
  await assert.rejects(
    updateKubepit({
      root,
      discover: async () => [f.release],
      download: download(f),
    }),
    /Updater feed platform/,
  );
  assert.deepEqual(await readFile(join(root, "Casks/kubepit.rb")), previous);
});
test("falls back to the newest complete prerelease while no stable release exists", () => {
  const first = fixture().release,
    second = fixture("0.0.2-rc.2").release;
  const third = fixture("0.0.2-rc.10").release,
    draft = fixture("1.0.0").release;
  draft.draft = true;
  const incomplete = fixture("2.0.0").release;
  incomplete.assets.pop();
  assert.equal(selectRelease([second, first, draft, third, incomplete]), third);
  assert.equal(selectRelease([]), undefined);
  assert.ok(compareVersions("1.0.0", "1.0.0-rc.10") > 0);
  assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
  assert.ok(compareVersions("1.0.0-rc.1", "1.0.0-rc.1.1") < 0);
  assert.throws(() => parseVersion("1.0.0-rc.01"));
  assert.throws(() => parseVersion("../main"));
});
test("prefers the newest complete stable release over a higher-version preview", () => {
  const older = fixture("0.0.1", false).release;
  const stable = fixture("0.0.2", false).release;
  const preview = fixture("1.0.0-beta.1", true).release;
  const flaggedPreview = fixture("2.0.0", true).release;
  const mislabeledPreview = fixture("3.0.0-rc.1", false).release;
  const incomplete = fixture("4.0.0", false).release;
  incomplete.assets.pop();
  assert.equal(
    selectRelease([
      older,
      preview,
      incomplete,
      flaggedPreview,
      stable,
      mislabeledPreview,
    ]),
    stable,
  );
});
test("rejects foreign repo/tag URLs and source identity before updating", () => {
  for (const mutate of [
    (f) => {
      f.manifest.repository = "other/repo";
    },
    (f) => {
      f.manifest.tag = "v9.9.9";
    },
    (f) => {
      f.manifest.assets[0].url = "https://example.com/fake.dmg";
    },
    (f) => {
      f.manifest.homebrew.caskUrl += "?redirect=evil";
    },
    (f) => {
      f.manifest.checksums.url = `${releaseRoot}/download/v0.0.2/SHA256SUMS`;
    },
    (f) => {
      f.manifest.commit = "not-a-sha";
    },
  ]) {
    const f = fixture();
    mutate(f);
    f.refresh();
    assert.throws(() => validate(f));
  }
  const f = fixture();
  f.release.assets[0].browser_download_url =
    "https://github.com/other/repo/file.dmg";
  assert.throws(() => validate(f), /URL/);
});
test("rejects incomplete/duplicate assets, tampering and inconsistent signing", () => {
  for (const mutate of [
    (f) => {
      f.manifest.assets.pop();
    },
    (f) => {
      f.manifest.assets[1] = f.manifest.assets[0];
    },
    (f) => {
      f.manifest.assets[0].sha256 = "0".repeat(64);
    },
    (f) => {
      f.manifest.assets[0].size += 1;
    },
    (f) => {
      f.manifest.assets[0].signing = "unsigned";
    },
  ]) {
    const f = fixture();
    mutate(f);
    f.refresh();
    assert.throws(() => validate(f));
  }
  const f = fixture();
  f.files.get("kubepit.rb")[10] ^= 1;
  assert.throws(() => validate(f), /checksum/);
  assert.throws(
    () =>
      parseChecksums(
        Buffer.from(`${"a".repeat(64)}  a\n${"a".repeat(64)}  a\n`),
      ),
    /duplicate/,
  );
  assert.throws(
    () => parseChecksums(Buffer.from(`${"a".repeat(64)}  ../outside\n`)),
    /Malformed/,
  );
});
test("a matching hash cannot authorize Ruby hooks or quarantine bypass", () => {
  const f = fixture();
  f.cask = Buffer.from(
    f.cask
      .toString()
      .replace(
        '  app "Kubepit.app"',
        '  app "Kubepit.app"\n  postflight do\n    system "xattr", "-cr", "/Applications/Kubepit.app"\n  end',
      ),
  );
  f.manifest.homebrew.sha256 = sha256(f.cask);
  f.refresh();
  assert.throws(() => validate(f), /allowed template/);
});
test("API token stays at api.github.com and API redirects are disabled", async () => {
  let call;
  await githubReleases(1, {
    token: "test-token",
    fetchImpl: async (url, options) => {
      call = { url, options };
      return Response.json([]);
    },
  });
  assert.equal(new URL(call.url).host, "api.github.com");
  assert.equal(call.options.headers.Authorization, "Bearer test-token");
  assert.equal(call.options.redirect, "error");
});
test("public release redirects never receive credentials and reject unknown hosts", async () => {
  const calls = [];
  const bytes = await publicAsset(`${releaseRoot}/download/v0.0.1/kubepit.rb`, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? new Response(null, {
            status: 302,
            headers: {
              location:
                "https://release-assets.githubusercontent.com/example?signature=test",
            },
          })
        : new Response("safe bytes");
    },
  });
  assert.equal(bytes.toString(), "safe bytes");
  assert.equal(calls.length, 2);
  for (const { options } of calls)
    assert.deepEqual(options.headers, { Accept: "application/octet-stream" });
  await assert.rejects(
    publicAsset(`${releaseRoot}/download/v0.0.1/kubepit.rb`, {
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.example/payload" },
        }),
    }),
    /Unsafe/,
  );
  await assert.rejects(
    publicAsset(`${releaseRoot}/download/v0.0.1/kubepit.rb`, {
      maxBytes: 3,
      fetchImpl: async () => new Response("too large"),
    }),
    /allowed size/,
  );
  await assert.rejects(
    publicAsset("https://github.com/other/repo/releases/download/v1/a"),
    /origin/,
  );
});
test("writes only Kubepit byte-for-byte, preserves RunHQ, and no-ops when current", async (t) => {
  const root = await staging(t),
    f = fixture();
  const options = {
    root,
    discover: async () => [f.release],
    download: download(f),
  };
  assert.equal(await updateKubepit(options), true);
  assert.deepEqual(await readFile(join(root, "Casks/kubepit.rb")), f.cask);
  assert.equal(
    await readFile(join(root, "Casks/runhq.rb"), "utf8"),
    "existing RunHQ cask\n",
  );
  assert.equal(await updateKubepit(options), false);
  assert.deepEqual((await readdir(join(root, "Casks"))).sort(), [
    "kubepit.rb",
    "runhq.rb",
  ]);
});
test("no release creates no cask; rejected bytes leave the current cask untouched", async (t) => {
  const root = await staging(t),
    f = fixture();
  assert.equal(await updateKubepit({ root, discover: async () => [] }), null);
  assert.deepEqual(await readdir(join(root, "Casks")), ["runhq.rb"]);
  await writeFile(join(root, "Casks/kubepit.rb"), '  version "0.0.2"\n');
  await assert.rejects(
    updateKubepit({
      root,
      discover: async () => [f.release],
      download: download(f),
    }),
    /downgrade/,
  );
  assert.equal(
    await readFile(join(root, "Casks/kubepit.rb"), "utf8"),
    '  version "0.0.2"\n',
  );
});
test("missing GitHub binary digest falls back to streaming byte verification", async (t) => {
  const root = await staging(t),
    f = fixture();
  delete f.release.assets[0].digest;
  let streamed = 0;
  const fetchFixture = download(f);
  await updateKubepit({
    root,
    discover: async () => [f.release],
    download: async (url, options) => {
      if (options.digestOnly) streamed++;
      return fetchFixture(url, options);
    },
  });
  assert.equal(streamed, 1);
});
