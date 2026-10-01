# Bounded Kubepit updates / Sınırlı Kubepit güncellemeleri

The [Update Kubepit cask workflow](../.github/workflows/check-kubepit.yml) is enabled
with explicit maintainer approval. It runs every six hours and on manual dispatch.
Each run checks out `main`, executes the validation tests, and verifies the published
release before considering any repository change.

[Update Kubepit cask iş akışı](../.github/workflows/check-kubepit.yml), depo sahibinin
açık onayıyla etkindir. Altı saatte bir veya elle başlatıldığında çalışır. Her çalışma
`main` dalını alır, doğrulama testlerini çalıştırır ve depoda değişiklik yapmadan önce
yayımlanmış sürümü doğrular.

The source is exclusively complete public releases of `erdembas/kubepit`. The newest
complete stable release takes priority; only when none exists may the newest complete
prerelease be used, including the initial 0.0.1 release. A later beta never supersedes
an available stable release, and an existing cask is never downgraded.

Kaynak yalnızca `erdembas/kubepit` deposunun dosyaları tamamlanmış herkese açık
sürümleridir. En yeni kararlı sürüm önceliklidir; yalnızca böyle bir sürüm yoksa
en yeni tamamlanmış ön sürüm kullanılır. Bu kural ilk 0.0.1 sürümünü de kapsar.
Sonraki betalar mevcut kararlı sürümün önüne geçmez; cask eski sürüme indirilmez.

The validator checks the exact repository/tag URLs, complete installer manifest,
SHA256SUMS, GitHub asset digests, and the cask's exact bytes against an allowed
template. It hashes downloaded installer bytes when GitHub does not supply a digest.
Downloaded code is never executed, and no cask hook may bypass macOS quarantine or
Gatekeeper. API credentials go only to `api.github.com` with redirects disabled;
release downloads and their redirect hosts receive no credentials.

The historical release format permits exactly 11 installers and the cask in
`SHA256SUMS`. Releases with updater metadata permit exactly 26 entries: those same
files, two macOS updater archives, 11 signature sidecars and `latest.json`.
All 11 updater payloads must match their prescribed target, format, URL and
platform keys. Embedded signature text must match its sidecar's byte size and hash;
the downloaded feed must match its published digest and the manifest's 13
platform mappings, including distinct Linux DEB/RPM and Windows NSIS/MSI keys.
This checks release metadata integrity; the desktop release
pipeline owns cryptographic updater signature verification. Neither format permits
unrelated checksum entries.

Doğrulayıcı; depo ve sürüm adreslerini, eksiksiz paket manifestini, SHA256SUMS
dosyasını, GitHub dosya özetlerini ve cask'in izin verilen şablonla birebir uyumunu
kontrol eder. GitHub özet sağlamazsa indirilen paket baytlarını özetler. İndirilen
kod çalıştırılmaz; macOS karantina veya Gatekeeper kontrolleri aşılmaz. API kimlik
bilgileri yalnızca yönlendirme kapalıyken `api.github.com` adresine gönderilir;
dosya indirmeleri ve yönlendirme sunucuları bu bilgileri almaz.

İlk sürüm biçiminde `SHA256SUMS` yalnızca 11 kurulum paketi ve cask içerir.
Güncelleyici verisi içeren sürümlerde tam 26 kayıt kabul edilir: aynı dosyalar,
iki macOS güncelleme arşivi, 11 imza dosyası ve `latest.json`. 11 güncelleme
paketinin hedefi, biçimi, adresi ve platform anahtarları beklenen değerlerle
eşleşmelidir. Gömülü imza metni, imza dosyasının bayt boyutu ve özetiyle; indirilen
akış dosyası ise yayımlanan özeti ve manifestteki 13 platform eşleştirmesiyle
uyumlu olmalıdır. Linux DEB/RPM ve Windows NSIS/MSI paketlerinin ayrı anahtarları
vardır. Bu kontroller sürüm verisinin bütünlüğünü doğrular; güncelleyici
imzalarının kriptografik doğrulaması masaüstü yayımlama akışına aittir. İki biçimde
de ilgisiz checksum kayıtlarına izin verilmez.

Repository write permission belongs only to the update job and uses the tap's
short-lived `GITHUB_TOKEN`; no cross-repository PAT is required. The final commit
step runs only when the validator emits `verified=true`. It stages only
`Casks/kubepit.rb`, exits when the diff is empty, and rejects any other staged path.
RunHQ, scripts, workflow files, and all other files are excluded from automatic
commits. A verified cask artifact is retained for seven days.

Depoya yazma yetkisi yalnızca güncelleme işine aittir ve tap'in kısa ömürlü
`GITHUB_TOKEN` değeriyle kullanılır; başka depoya erişen PAT gerekmez. Commit adımı
yalnızca doğrulayıcı `verified=true` üretirse çalışır. Sadece `Casks/kubepit.rb`
dosyasını hazırlar, fark yoksa çıkar ve başka bir dosya hazırlanmışsa durur. RunHQ,
betikler, iş akışı dosyaları ve diğer dosyalar otomatik commit kapsamı dışındadır.
Doğrulanmış cask çıktısı yedi gün saklanır.

Updates use a normal push to `main`. Concurrent runs are serialized. Failed
validation or a non-fast-forward push fails the run; the workflow never force-pushes,
changes branch protection, or bypasses an approval rule. If repository protections
require pull requests, maintainers must review and publish the verified cask through
that process instead.

Güncellemeler `main` dalına normal push ile gönderilir; aynı anda başlayan çalışmalar
sırayla yürütülür. Doğrulama veya ileri yönlü push başarısızsa iş akışı durur. Zorla
push yapmaz, dal korumasını değiştirmez veya onay kurallarını aşmaz. Depo korumaları
pull request gerektiriyorsa doğrulanmış cask bu inceleme süreciyle yayımlanmalıdır.
