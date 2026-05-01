cask "runhq" do
  arch arm: "aarch64", intel: "x64"

  version "0.10.2"
  sha256 arm:   "41444622f7034f37bc481fb453df2fb3d54529b9f35e2aaf8ae3a351ab2df549",
         intel: "24591a075f7f0c295b1996ccd9804d8d7646b895575c97ffc909d560b917149b"

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
