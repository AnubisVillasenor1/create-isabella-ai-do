package ai.gameover.model;

import java.util.List;

/** Declared identity of a governed agent. */
public record AgentIdentity(
    String id,
    String name,
    String organization,
    String owner,
    List<String> capabilities,
    String createdAt) {
}
