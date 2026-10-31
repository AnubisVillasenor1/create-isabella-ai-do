use cognition::planner::RiskTier;
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Policy {
    pub capability: String,
    pub min_role: String,
    pub max_risk: RiskTier,
    pub requires_human_approval: bool,
}
impl Policy {
    pub fn permits_proposal(&self, risk: RiskTier) -> bool {
        !matches!(
            (self.max_risk, risk),
            (
                RiskTier::Low,
                RiskTier::Medium | RiskTier::High | RiskTier::Critical
            ) | (RiskTier::Medium, RiskTier::High | RiskTier::Critical)
                | (RiskTier::High, RiskTier::Critical)
        )
    }
}
