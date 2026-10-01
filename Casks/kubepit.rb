cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "0.0.5"
  sha256 arm:   "8b68867cfe0bd08f4b0f4426b1a223cf93399fe1d37a8b27c1311baab71bcdf2",
         intel: "1e3de434e654a648369698bd0dcc6fe0086b6dbe8b7fe2bc41e61b58f41e0723"

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
