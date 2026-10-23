package ai.gameover;

import hudson.Extension;
import hudson.ExtensionList;
import jenkins.model.GlobalConfiguration;
import net.sf.json.JSONObject;
import org.kohsuke.stapler.DataBoundSetter;
import org.kohsuke.stapler.StaplerRequest;

/** Global configuration: optional remote gateway URL and fail-closed policy. */
@Extension
public class GameOverGlobalConfiguration extends GlobalConfiguration {

  private String gatewayUrl = "";
  private boolean failClosed = true;

  public GameOverGlobalConfiguration() {
    load();
  }

  public static GameOverGlobalConfiguration get() {
    return ExtensionList.lookupSingleton(GameOverGlobalConfiguration.class);
  }

  public String getGatewayUrl() {
    return gatewayUrl;
  }

  @DataBoundSetter
  public void setGatewayUrl(String gatewayUrl) {
    this.gatewayUrl = gatewayUrl == null ? "" : gatewayUrl;
    save();
  }

  public boolean isFailClosed() {
    return failClosed;
  }

  @DataBoundSetter
  public void setFailClosed(boolean failClosed) {
    this.failClosed = failClosed;
    save();
  }

  @Override
  public boolean configure(StaplerRequest req, JSONObject json) throws FormException {
    req.bindJSON(this, json);
    save();
    return true;
  }
}
