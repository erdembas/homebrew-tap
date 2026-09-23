cask "runhq" do
  arch arm: "aarch64", intel: "x64"

  version "3.0.0"
  sha256 arm:   "a0bdd4dd5cb51ac6eb97b2db8416cc5f64d7aa02a1b0d49cb5f2c49502d5ce7d",
         intel: "87cc30e0987eac778eef359a6ffedca23dd59dc16785143f646e22bb35a2b1b0"

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
