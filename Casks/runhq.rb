cask "runhq" do
  arch arm: "aarch64", intel: "x64"

  version "0.1.1"
  sha256 arm:   "1e563eba5e9689185a6e09272e1d758a52ad7b9caea636d7080b324401038ab6",
         intel: "96fcb725dbebceaa559992bc9b80f791150490700c08d0c0895fae88c4fdc332"

  url "https://github.com/erdembas/runhq/releases/download/v#{version}/RunHQ_#{version}_#{arch}.dmg",
      verified: "github.com/erdembas/runhq/"

  name "RunHQ"
  desc "Universal local service orchestrator"
  homepage "https://runhq.dev/"

  depends_on macos: ">= :ventura"

  app "RunHQ.app"

  zap trash: [
    "~/Library/Application Support/com.runhq.desktop",
    "~/Library/Caches/com.runhq.desktop",
    "~/Library/Preferences/com.runhq.desktop.plist",
    "~/Library/Saved Application State/com.runhq.desktop.savedState",
  ]
end
