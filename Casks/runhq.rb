cask "runhq" do
  arch arm: "aarch64", intel: "x64"

  version "2.0.0"
  sha256 arm:   "a5f0b9e6f0ec1d293eacb89e85f9ca802f7a8173718493f7174164b008ee6850",
         intel: "3b14ab1e19873b36d8c00c6e3126ec45357053ad84380f77ca1ddfbf36bbffd8"

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
