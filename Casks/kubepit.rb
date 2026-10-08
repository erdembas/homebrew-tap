cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "0.0.9"
  sha256 arm:   "4823ce9b7651fa3894a40e694f878cc6d45917228da12b7cd5832c06dc109c8d",
         intel: "6d77ccad48d87b640c5687ea8f6fec9293025394325d1d178f5a57dad3b8686c"

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
