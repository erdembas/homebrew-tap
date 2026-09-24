cask "runhq" do
  arch arm: "aarch64", intel: "x64"

  version "3.4.0"
  sha256 arm:   "0ed717b97a7915060d990906fa234480f17a3a1652d35f507ecec5feea815cd7",
         intel: "b68853554952278c5f3fb8f4ecb4eec3b6f919dc8c9efc2e4f86f7afd15466fb"

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
