cask "kubepit" do
  arch arm: "arm64", intel: "x64"

  version "0.0.4"
  sha256 arm:   "ce85c5acb0bafc440db7d1fe96fad1026b816b6338ab6960b93adf22104a8441",
         intel: "f604192b9622bca8b84565a9addd3e27181eec71f0ff49e998e3af31151659c0"

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
