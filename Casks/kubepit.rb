cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "0.0.3"
  sha256 arm:   "5b1587599fdfcd192ad0a9f0dddbd4651e576eac9c6bb79d418994f838df91ae",
         intel: "814f5205b5ecc3cc1088fdd710a7708b24e2b7df0b4122ab33ad18c3a5fccd9f"

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
