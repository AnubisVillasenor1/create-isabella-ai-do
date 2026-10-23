pub struct BetaEngine;
impl BetaEngine {
    pub fn validate(candidate: &str) -> bool {
        !candidate.trim().is_empty() && candidate.chars().count() <= 12_000
    }
}
