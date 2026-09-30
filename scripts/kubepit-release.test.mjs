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
} from "./kubepit-release.mjs";
import {
  publicAsset,
  githubReleases,
  updateKubepit,
} from "./update-kubepit.mjs";

function fixture(version = "0.0.1", prerelease = true) {
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
  result.refresh = () => {
    files.set("kubepit.rb", result.cask);
    files.set("release-manifest.json", Buffer.from(JSON.stringify(manifest)));
    files.set(
      "SHA256SUMS",
      Buffer.from(
        [
          ...assets.map((a) => `${a.sha256}  ${a.name}`),
          `${manifest.homebrew.sha256}  kubepit.rb`,
        ].join("\n") + "\n",
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
