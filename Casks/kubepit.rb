cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "0.0.1"
  sha256 arm:   "cff02e111ec407801ab3b1bdd1b85151d089724a05313e673be7e2a2bae6ca07",
         intel: "981b5a222f9740136f32ae7bb38542e6c84e49068cbd14359e52eb322eba64c9"

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
