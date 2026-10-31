package ai.gameover;

import hudson.Extension;
import hudson.model.Descriptor;

/** Descriptor for the GAME OVER plugin metadata. */
@Extension
public class GameOverDescriptor extends Descriptor<GameOverPlugin> {

  public GameOverDescriptor() {
    super(GameOverPlugin.class);
  }

  @Override
  public String getDisplayName() {
    return "GAME OVER / UAGP-1";
  }
}
