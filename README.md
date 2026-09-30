# erdembas/homebrew-tap

A Homebrew tap for my open-source tools.

## Available casks

- [**RunHQ**](https://runhq.dev/) — the universal local service orchestrator.
  ```bash
  brew tap erdembas/tap
  brew install --cask runhq
  ```

- [**Kubepit**](https://erdembas.github.io/kubepit/) — a local-first Kubernetes IDE.

## Kubepit / Türkçe

[Kubepit](https://erdembas.github.io/kubepit/) is a free, MIT-licensed Kubernetes IDE.
The **0.0.1** cask is available for Apple Silicon and Intel macOS 11+. It uses the
verified DMGs from the complete
[desktop release](https://github.com/erdembas/kubepit/releases/tag/v0.0.1).
You can also explore the [browser demo](https://erdembas.github.io/kubepit/demo/).

```bash
brew tap erdembas/tap
brew install --cask kubepit
```

Apple Silicon and Intel Macs use separate checksum-pinned DMGs. The current release
may be a prerelease. Signing status is declared in its
[release notes and manifest](https://github.com/erdembas/kubepit/releases);
this cask does not change macOS quarantine or Gatekeeper settings.

Kubepit, MIT lisanslı ücretsiz bir Kubernetes IDE'dir. **0.0.1** cask dosyası,
Apple Silicon ve Intel macOS 11+ için hazırdır. Tam masaüstü sürümünün doğrulanmış
DMG dosyalarını kullanır; yukarıdaki komutlarla kurulabilir.
Apple Silicon ve Intel paketleri ayrı SHA-256 değerleriyle doğrulanır. Sürüm bir ön
sürüm olabilir; imza durumunu sürüm notlarında ve manifestte inceleyin. Cask, macOS
karantina veya Gatekeeper ayarlarını değiştirmez.

### Maintainers / Bakım

Node.js 22 or newer is required; no npm dependencies are needed.

```bash
node --test scripts/*.test.mjs
node scripts/update-kubepit.mjs
git diff -- Casks/kubepit.rb
```

The updater selects the newest complete stable release. It falls back to the newest
complete prerelease only while no complete stable release exists, supporting the
initial 0.0.1 release without moving stable installations to later betas. It checks the exact
repository/tag URLs, manifest, SHA256SUMS, GitHub asset digests and the published
cask bytes against an allowed template. Downloads are never executed. API
credentials are never attached to release downloads or their redirect hosts.
Only `Casks/kubepit.rb` can be updated; RunHQ is not changed.

The manual **Verify Kubepit cask** workflow produces a reviewable artifact and does
not commit or push. Scheduled automatic commits remain disabled; the bounded
proposal is documented in [docs/kubepit-automation.md](docs/kubepit-automation.md).

Güncelleyici, dosyaları tamamlanmış en yeni kararlı sürümü seçer. Yalnızca böyle bir
kararlı sürüm yokken en yeni tamamlanmış ön sürümü kullanır. Böylece ilk 0.0.1 sürümü
desteklenir; kararlı kurulumlar sonraki betalara geçirilmez. Adresleri, manifesti,
SHA256SUMS dosyasını, GitHub dosya özetlerini ve cask içeriğini doğrular. İndirilen
dosyaları çalıştırmaz; API kimlik bilgilerini dosya indirmelerine veya yönlendirme
sunucularına göndermez. Yalnızca `Casks/kubepit.rb` güncellenir, RunHQ değişmez.
Elle başlatılan doğrulama iş akışı bir inceleme dosyası üretir; commit veya push
yapmaz. Zamanlanmış otomatik commit özelliği henüz etkin değildir.
