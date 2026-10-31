package ai.gameover;

import hudson.Extension;
import hudson.model.Run;
import hudson.model.TaskListener;
import hudson.util.ListBoxModel;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.jenkinsci.plugins.workflow.steps.StepDescriptor;

/** Descriptor for {@link GovernanceStep}. */
@Extension
public class GovernanceStepDescriptor extends StepDescriptor {

  @Override
  public Set<? extends Class<?>> getRequiredContext() {
    return Set.of(Run.class, TaskListener.class);
  }

  @Override
  public String getFunctionName() {
    return "gameOverGovernance";
  }

  @Override
  public String getDisplayName() {
    return "GAME OVER Governance (UAGP-1)";
  }

  public ListBoxModel doFillCriticalityItems() {
    ListBoxModel items = new ListBoxModel();
    for (String value : List.of("LOW", "MEDIUM", "HIGH", "CRITICAL")) {
      items.add(value, value.toUpperCase(Locale.ROOT));
    }
    return items;
  }
}
