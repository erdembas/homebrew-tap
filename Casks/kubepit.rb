cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "0.0.6"
  sha256 arm:   "d3eec6d1dfd8fde755bccd83715bff71ee569920e3bb6eacda965ad883d4cc70",
         intel: "43e8df885f7cafeda0496074c97436e7a1cb63b0de94e82559ee686fd55206cf"

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
