#[test]
fn ledger_guarantee_is_explicitly_limited() {
    let docs = include_str!("../../../docs/CRYPTOGRAPHIC-AUDIT.md");
    assert!(docs.contains("No es una firma digital"));
}
