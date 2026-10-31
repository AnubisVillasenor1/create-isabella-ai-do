use cognition::planner::RiskTier;
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CrownDecision {
    Allow,
    Repair,
    Degrade,
    Reject,
    Escalate,
}
pub struct Crown;
impl Crown {
    pub fn arbitrate(
        accepted: bool,
        risk: RiskTier,
        human_approval_required: bool,
    ) -> CrownDecision {
        if human_approval_required {
            return CrownDecision::Escalate;
        }
        match risk {
            RiskTier::Critical | RiskTier::High => CrownDecision::Escalate,
            RiskTier::Medium => {
                if accepted {
                    CrownDecision::Repair
                } else {
                    CrownDecision::Degrade
                }
            }
            RiskTier::Low => {
                if accepted {
                    CrownDecision::Allow
                } else {
                    CrownDecision::Reject
                }
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn critical_escalates() {
        assert_eq!(
            Crown::arbitrate(true, RiskTier::Critical, false),
            CrownDecision::Escalate
        )
    }
    #[test]
    fn human_approval_overrides_low_risk() {
        assert_eq!(
            Crown::arbitrate(true, RiskTier::Low, true),
            CrownDecision::Escalate
        )
    }
}
