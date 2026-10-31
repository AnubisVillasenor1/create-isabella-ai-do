package ai.gameover.audit;

/** Records governance decisions to a local BookPI mirror ledger. */
public class AuditService {

  private static final String DEFAULT_TYPE = "gameover.governance.decision";
  private static final String DEFAULT_METHOD = "TINA.YUN.GAMEOVER.govern_agent_action.v0.1.0.HIGH.HUMAN_IN_THE_LOOP";

  private final BookPILedger ledger;

  public AuditService() {
    this(new BookPILedger());
  }

  public AuditService(BookPILedger ledger) {
    this.ledger = ledger;
  }

  public AuditRecord record(String principal, String riskTier, String status) {
    return ledger.append(DEFAULT_TYPE, DEFAULT_METHOD, principal, riskTier, status);
  }

  public BookPILedger ledger() {
    return ledger;
  }
}
