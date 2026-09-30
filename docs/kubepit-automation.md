# Proposed bounded Kubepit updates / Önerilen sınırlı güncellemeler

This document is a review draft, not an executable workflow. The active manual
workflow has read-only repository permissions and only produces a cask artifact.
Enabling the following recurring repository writes requires explicit approval.

Bu belge inceleme taslağıdır; çalıştırılan bir iş akışı değildir. Mevcut elle
başlatılan iş akışı depoya salt okunur erişir ve yalnızca cask çıktısı üretir.
Aşağıdaki düzenli depo güncellemeleri etkinleştirilmeden önce açık onay gerekir.

The proposed scope is only `Casks/kubepit.rb` in `erdembas/homebrew-tap`, every six
hours and on manual dispatch. It uses that repository's short-lived `GITHUB_TOKEN`;
no cross-repository PAT is required. The source is exclusively complete public
releases of `erdembas/kubepit`: the newest complete stable release takes priority.
Only when none exists may the newest complete prerelease be used (including the
initial 0.0.1 release). A later beta never supersedes an available stable release.
All existing validation
remains mandatory. RunHQ and all other paths are excluded from staging. A rejected
validation or non-fast-forward push fails the run without replacing remote data.

Önerilen kapsam, `erdembas/homebrew-tap` deposundaki yalnızca `Casks/kubepit.rb`
dosyasını altı saatte bir ve elle başlatıldığında güncellemektir. Deponun kısa
ömürlü `GITHUB_TOKEN` değeri kullanılır; başka depoya erişen PAT gerekmez. Dosyaları
tamamlanmış en yeni kararlı sürüm önceliklidir; yalnızca böyle bir sürüm yokken
en yeni tamamlanmış ön sürüm kullanılır. Sonraki betalar kararlı sürümün önüne geçmez. RunHQ
ve diğer dosyalar commit'e alınmaz. Doğrulama veya ileri yönlü push başarısızsa
iş akışı durur, uzak dosyaların üzerine yazılmaz.

Proposed changes to `.github/workflows/check-kubepit.yml`, after approval:

```yaml
name: Update Kubepit cask
on:
  workflow_dispatch:
  schedule:
    - cron: "17 */6 * * *"
permissions:
  contents: read
concurrency:
  group: kubepit-cask-update
  cancel-in-progress: false
jobs:
  verify:
    permissions:
      contents: write
```

Keep the existing tests, verification and artifact steps. Change checkout to use
`ref: main` and the default persisted token so the final bounded push can work.
Append this final step; it cannot stage RunHQ, scripts or workflow files:

```yaml
- name: Commit only the verified Kubepit cask
  shell: bash
  run: |
    if [ ! -f Casks/kubepit.rb ]; then exit 0; fi
    git add -- Casks/kubepit.rb
    if git diff --cached --quiet; then exit 0; fi
    staged=$(git diff --cached --name-only)
    if [ "$staged" != 'Casks/kubepit.rb' ]; then
      echo 'Unexpected staged paths; refusing to commit.' >&2
      exit 1
    fi
    git config user.name 'github-actions[bot]'
    git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
    git commit -m 'Update Kubepit Homebrew cask'
    git push origin HEAD:main
```

Repository branch protection may require a separate pull-request workflow. This
proposal never changes branch protection, adds a PAT, force-pushes or bypasses an
approval rule. Until explicitly enabled, maintainers can review and publish the
verified cask using their normal repository process.

Dal koruması varsa ayrı bir pull request süreci gerekebilir. Bu taslak dal korumasını
değiştirmez, PAT eklemez, zorla push yapmaz ve onay kurallarını aşmaz. Etkinleştirilene
kadar doğrulanan cask mevcut depo inceleme süreciyle yayımlanabilir.
