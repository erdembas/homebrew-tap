cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "0.0.2"
  sha256 arm:   "8c9550d86e471e2c06951347f32e881d0bd4a3c5f3150f3912f793d608b3f6c7",
         intel: "cd5633184e4f0c30edada4814aa4c70216b4f6ce513a4c5336b61f8391787d38"

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
