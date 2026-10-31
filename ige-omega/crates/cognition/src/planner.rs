use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub plan_id: String,
    pub objective: String,
    pub steps: Vec<String>,
    pub success_probability: Option<f32>,
    pub probability_status: String,
    pub risk: RiskTier,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RiskTier {
    Low,
    Medium,
    High,
    Critical,
}
pub struct Planner;
impl Planner {
    pub fn create_plan(objective: &str, risk: RiskTier) -> Plan {
        Plan {
            plan_id: Uuid::now_v7().to_string(),
            objective: objective.to_owned(),
            steps: vec![
                "Validar identidad y política".into(),
                "Recolectar evidencia con procedencia".into(),
                "Construir hipótesis alternativas".into(),
                "Evaluar escenarios dentro del presupuesto".into(),
                "Arbitrar según riesgo y consentimiento".into(),
                "Registrar decisión y evidencia".into(),
            ],
            success_probability: None,
            probability_status: "NOT_ESTIMATED_NOT_CALIBRATED".into(),
            risk,
        }
    }
}
