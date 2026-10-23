use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CognitiveState {
    Ingress,
    Identity,
    Policy,
    Perception,
    Reasoning,
    Simulation,
    Arbitration,
    Execution,
    Evidence,
    Completed,
    Failed,
}
#[derive(Debug, Clone)]
pub struct StateMachine {
    state: CognitiveState,
}
impl Default for StateMachine {
    fn default() -> Self {
        Self::new()
    }
}
impl StateMachine {
    pub fn new() -> Self {
        Self {
            state: CognitiveState::Ingress,
        }
    }
    pub fn state(&self) -> CognitiveState {
        self.state
    }
    pub fn transition(&mut self, next: CognitiveState) -> Result<(), String> {
        use CognitiveState::*;
        let ok = matches!(
            (self.state, next),
            (Ingress, Identity | Failed)
                | (Identity, Policy | Failed)
                | (Policy, Perception | Failed)
                | (Perception, Reasoning | Failed)
                | (Reasoning, Simulation | Arbitration | Failed)
                | (Simulation, Arbitration | Failed)
                | (Arbitration, Execution | Evidence | Failed)
                | (Execution, Evidence | Failed)
                | (Evidence, Completed | Failed)
        );
        if ok {
            self.state = next;
            Ok(())
        } else {
            Err(format!("invalid transition {:?} -> {:?}", self.state, next))
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_skipped_policy() {
        assert!(StateMachine::new()
            .transition(CognitiveState::Execution)
            .is_err());
    }
}
