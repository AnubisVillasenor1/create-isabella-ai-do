package ai.gameover;

import ai.gameover.model.AgentIdentity;
import ai.gameover.model.UagpRequest;
import ai.gameover.model.UagpResult;
import hudson.AbortException;
import hudson.model.TaskListener;
import hudson.model.User;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jenkinsci.plugins.workflow.steps.Step;
import org.jenkinsci.plugins.workflow.steps.StepContext;
import org.jenkinsci.plugins.workflow.steps.StepExecution;
import org.jenkinsci.plugins.workflow.steps.SynchronousNonBlockingStepExecution;
import org.kohsuke.stapler.DataBoundConstructor;
import org.kohsuke.stapler.DataBoundSetter;

/**
 * Pipeline step {@code gameOverGovernance}: runs the UAGP-1 gate before a build
 * proceeds. The step decides and records; it never executes the governed action.
 */
public class GovernanceStep extends Step implements Serializable {

  private static final long serialVersionUID = 1L;

  private final String passportId;
  private final String objectiveTitle;
  private final String agentId;
  private final String agentName;
  private final String agentOwner;
  private final String agentOrganization;
  private final String capabilities;
  private final String actions;

  private String objectiveDescription = "";
  private String criticality = "MEDIUM";
  private String dataClasses = "";
  private String humanApprover = "";
  private boolean failOnReject = true;

  @DataBoundConstructor
  public GovernanceStep(String passportId, String objectiveTitle, String agentId, String agentName, String agentOwner,
      String agentOrganization, String capabilities, String actions) {
    this.passportId = passportId;
    this.objectiveTitle = objectiveTitle;
    this.agentId = agentId;
    this.agentName = agentName;
    this.agentOwner = agentOwner;
    this.agentOrganization = agentOrganization;
    this.capabilities = capabilities;
    this.actions = actions;
  }

  public String getPassportId() {
    return passportId;
  }

  public String getObjectiveTitle() {
    return objectiveTitle;
  }

  public String getAgentId() {
    return agentId;
  }

  public String getAgentName() {
    return agentName;
  }

  public String getAgentOwner() {
    return agentOwner;
  }

  public String getAgentOrganization() {
    return agentOrganization;
  }

  public String getCapabilities() {
    return capabilities;
  }

  public String getActions() {
    return actions;
  }

  public String getObjectiveDescription() {
    return objectiveDescription;
  }

  @DataBoundSetter
  public void setObjectiveDescription(String objectiveDescription) {
    this.objectiveDescription = objectiveDescription;
  }

  public String getCriticality() {
    return criticality;
  }

  @DataBoundSetter
  public void setCriticality(String criticality) {
    this.criticality = criticality;
  }

  public String getDataClasses() {
    return dataClasses;
  }

  @DataBoundSetter
  public void setDataClasses(String dataClasses) {
    this.dataClasses = dataClasses;
  }

  public String getHumanApprover() {
    return humanApprover;
  }

  @DataBoundSetter
  public void setHumanApprover(String humanApprover) {
    this.humanApprover = humanApprover;
  }

  public boolean isFailOnReject() {
    return failOnReject;
  }

  @DataBoundSetter
  public void setFailOnReject(boolean failOnReject) {
    this.failOnReject = failOnReject;
  }

  @Override
  public StepExecution start(StepContext context) {
    return new Execution(this, context);
  }

  /** Runs the gate synchronously (pure computation, no blocking I/O). */
  public static class Execution extends SynchronousNonBlockingStepExecution<UagpResult> {

    private static final long serialVersionUID = 1L;
    private final GovernanceStep step;

    Execution(GovernanceStep step, StepContext context) {
      super(context);
      this.step = step;
    }

    @Override
    protected UagpResult run() throws Exception {
      TaskListener listener = getContext().get(TaskListener.class);
      String principal = currentPrincipal();
      UagpRequest request = new UagpRequest(
          java.util.UUID.randomUUID().toString(),
          GameOverPlugin.PROTOCOL,
          new AgentIdentity(step.getAgentId(), step.getAgentName(), step.getAgentOrganization(), step.getAgentOwner(),
              splitCsv(step.getCapabilities()), java.time.Instant.now().toString()),
          step.getPassportId(),
          step.getObjectiveTitle(),
          step.getObjectiveDescription(),
          splitCsv(step.getActions()),
          splitCsv(step.getDataClasses()),
          List.of(),
          step.getCriticality(),
          Map.of(),
          null,
          blankToNull(step.getHumanApprover()));
      UagpResult result = new UagpGateway().govern(request, principal);
      if (listener != null) {
        listener.getLogger().println("[GAME OVER] " + result.decision().explainability());
        listener.getLogger().println("[GAME OVER] audit hash=" + result.auditHash() + " seq=" + result.auditSequence());
      }
      if (step.isFailOnReject() && !result.allowed()) {
        throw new AbortException("GAME OVER governance " + result.outcome() + ": " + result.decision().rationale());
      }
      return result;
    }

    private static String currentPrincipal() {
      try {
        User user = User.current();
        if (user != null && user.getId() != null && !user.getId().isBlank()) {
          return user.getId();
        }
      } catch (RuntimeException ignored) {
        // fall through to the default principal
      }
      return "jenkins";
    }
  }

  /** Split a comma-separated list, trimming and dropping blanks. */
  public static List<String> splitCsv(String value) {
    List<String> result = new ArrayList<>();
    if (value == null) {
      return result;
    }
    for (String part : value.split(",")) {
      String trimmed = part.trim();
      if (!trimmed.isEmpty()) {
        result.add(trimmed);
      }
    }
    return result;
  }

  private static String blankToNull(String value) {
    return (value == null || value.isBlank()) ? null : value.trim();
  }
}
