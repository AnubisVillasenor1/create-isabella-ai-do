package ai.gameover.model;

/** Reference to a piece of evidence backing a governance request. */
public record EvidenceReference(
    String id,
    String kind,
    String uri,
    String sha256) {
}
