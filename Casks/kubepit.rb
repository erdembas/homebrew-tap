cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "0.0.10"
  sha256 arm:   "d6b98a22a73d0c0f4c042201e5c72987fe930c548b4c387460643dbbecfc136c",
         intel: "031c2905f64015a018391b06313eb36fe1ab3f809eed5d1361e3ef7e5fc7b6b9"

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
