cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "0.0.12"
  sha256 arm:   "754ac36e155f06b34240b131c7744032a005eb2164c196469e36a4f9b109a8db",
         intel: "d34acdcd2dbeb1382552ec0b1785a157b4b29e39abbac63102cce4aea516a33b"

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
