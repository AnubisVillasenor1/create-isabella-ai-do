use cognition::ReasoningEngine;
#[test]
fn rejects_blank_input() {
    assert!(ReasoningEngine::reason(" ").is_err());
}
#[test]
fn does_not_claim_calibrated_probability() {
    let p = ReasoningEngine::reason("Explain a safe design").unwrap();
    assert!(p.success_probability.is_none());
}
#[test]
fn critical_language_escalates() {
    assert_eq!(
        format!(
            "{:?}",
            ReasoningEngine::reason("delete production credentials")
                .unwrap()
                .risk
        ),
        "Critical"
    );
}
