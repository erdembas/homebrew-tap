cask "runhq" do
  arch arm: "aarch64", intel: "x64"

  version "3.5.0"
  sha256 arm:   "35a4315397191e3655e052a3c21c58bd23ded50a9aac4e8744d4ea41b2bc66ef",
         intel: "a93d1f228ac0484ec246e33bff2c7de2ac698c1f506473e7b8ac57a7d64e489c"

  url "https://github.com/erdembas/runhq/releases/download/v#{version}/RunHQ_#{version}_#{arch}.dmg",
      verified: "github.com/erdembas/runhq/"

  name "RunHQ"
  desc "Universal local service orchestrator"
  homepage "https://runhq.dev/"

  depends_on macos: ">= :ventura"

  app "RunHQ.app"

  # RunHQ ships with an ad-hoc code signature rather than an Apple
  # Developer ID. Without this postflight, Gatekeeper would block
  # first launch with "unidentified developer" (right-click → Open
  # works, but it's a worse UX than a one-time xattr clear).
  # Clearing the quarantine attribute tells macOS to skip the
  # Gatekeeper assessment entirely — safe for apps installed via a
  # trusted package manager.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/RunHQ.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/com.runhq.desktop",
    "~/Library/Caches/com.runhq.desktop",
    "~/Library/Preferences/com.runhq.desktop.plist",
    "~/Library/Saved Application State/com.runhq.desktop.savedState",
  ]
end
