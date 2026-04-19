cask "runhq" do
  version "0.1.0"
  sha256 "0019dfc4b32d63c1392aa264aed2253c1e0c2fb09216f8e2cc269bbfb8bb49b5"

  url "https://github.com/erdembas/runhq/releases/download/v0.1.0/RunHQ_0.1.0_aarch64.dmg"
  name "RunHQ"
  desc "The universal local service orchestrator."
  homepage "https://github.com/erdembas/runhq"

  depends_on macos: ">= :ventura"

  app "RunHQ.app"
end
