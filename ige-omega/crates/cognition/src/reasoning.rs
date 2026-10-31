use crate::{
    alpha::AlphaEngine,
    beta::BetaEngine,
    planner::{Plan, Planner, RiskTier},
};
use shared::{IgeError, IgeResult};

pub struct ReasoningEngine;

impl ReasoningEngine {
    pub fn reason(input: &str) -> IgeResult<Plan> {
        let text = input.trim();
        if text.is_empty() {
            return Err(IgeError::InvalidInput("text must not be empty".into()));
        }
        if text.chars().count() > 12_000 {
            return Err(IgeError::InvalidInput(
                "text exceeds 12000 characters".into(),
            ));
        }
        if !AlphaEngine::hypotheses(text)
            .iter()
            .any(|hypothesis| BetaEngine::validate(hypothesis))
        {
            return Err(IgeError::InvalidInput("no valid hypothesis".into()));
        }

        let risk = classify_risk(text);
        Ok(Planner::create_plan(text, risk))
    }
}

/// Conservative lexical triage only. It is not an authorization policy and
/// cannot establish intent, context, or safety by itself.
pub fn classify_risk(input: &str) -> RiskTier {
    let text = input.to_lowercase();

    const CRITICAL: &[&str] = &[
        "drop database",
        "credential",
        "credentials",
        "payment",
        "production secret",
        "delete credentials",
        "borrar base de datos",
        "borrar la base de datos",
        "eliminar base de datos",
        "eliminar la base de datos",
        "credencial",
        "contraseña",
        "contrasena",
        "clave privada",
        "secreto de producción",
        "secreto de produccion",
        "pago",
        "transferencia bancaria",
        "token de acceso",
    ];
    const HIGH: &[&str] = &[
        "delete",
        "deploy",
        "transfer",
        "execute",
        "production",
        "eliminar",
        "borrar",
        "desplegar",
        "transferir",
        "ejecutar",
        "producción",
        "produccion",
        "publicar",
        "instalar",
        "reiniciar",
    ];

    if CRITICAL.iter().any(|keyword| text.contains(keyword)) {
        RiskTier::Critical
    } else if HIGH.iter().any(|keyword| text.contains(keyword)) {
        RiskTier::High
    } else if input.chars().count() > 2_000 {
        RiskTier::Medium
    } else {
        RiskTier::Low
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_blank_input() {
        assert!(ReasoningEngine::reason(" \n ").is_err());
    }

    #[test]
    fn does_not_invent_success_probability() {
        let plan = ReasoningEngine::reason("Describe a safe design").unwrap();
        assert_eq!(plan.success_probability, None);
        assert_eq!(plan.probability_status, "NOT_ESTIMATED_NOT_CALIBRATED");
    }

    #[test]
    fn critical_english_and_spanish_operations_escalate() {
        assert_eq!(
            classify_risk("drop database production"),
            RiskTier::Critical
        );
        assert_eq!(classify_risk("borrar la base de datos"), RiskTier::Critical);
        assert_eq!(classify_risk("publicar en producción"), RiskTier::High);
    }

    #[test]
    fn ordinary_documentation_request_is_not_automatically_high_risk() {
        assert_eq!(
            classify_risk("escribir documentación para el sistema"),
            RiskTier::Low
        );
    }

    #[test]
    fn rejects_overlong_input() {
        assert!(ReasoningEngine::reason(&"x".repeat(12_001)).is_err());
    }
}
