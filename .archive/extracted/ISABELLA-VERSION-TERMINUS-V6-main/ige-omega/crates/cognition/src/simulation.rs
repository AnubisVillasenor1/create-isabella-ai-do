use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scenario {
    pub name: String,
    pub probability: f64,
    pub impact: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub iterations: u32,
    pub expected_impact: f64,
    pub worst_case_impact: f64,
    pub p95_impact: f64,
    pub budget_exhausted: bool,
    pub method: String,
}

/// Deterministic, bounded scenario sampling. The inputs are caller-authored
/// assumptions, not measured probabilities or causal facts.
pub fn simulate(
    scenarios: &[Scenario],
    requested: u32,
    budget: u32,
) -> Result<SimulationResult, String> {
    if scenarios.is_empty() || scenarios.len() > 128 {
        return Err("scenario count must be between 1 and 128".into());
    }
    if requested == 0 || budget == 0 {
        return Err("requested iterations and budget must be greater than zero".into());
    }
    if scenarios.iter().any(|scenario| {
        scenario.name.trim().is_empty()
            || scenario.name.chars().count() > 200
            || !scenario.probability.is_finite()
            || !scenario.impact.is_finite()
            || !(0.0..=1.0).contains(&scenario.probability)
            || scenario.impact < 0.0
    }) {
        return Err(
            "scenario names must be bounded; probabilities must be finite in [0,1] and impacts finite/non-negative"
                .into(),
        );
    }

    let total: f64 = scenarios.iter().map(|scenario| scenario.probability).sum();
    if (total - 1.0).abs() > 1e-6 {
        return Err("scenario probabilities must sum to 1 within 1e-6".into());
    }

    let iterations = requested.min(budget).min(100_000);
    let mut samples = Vec::with_capacity(iterations as usize);
    let mut seed: u64 = 0x9E3779B97F4A7C15;

    for _ in 0..iterations {
        seed = seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        let draw = (seed >> 11) as f64 / ((1u64 << 53) as f64);
        let mut cumulative = 0.0;
        let mut selected = scenarios
            .iter()
            .rev()
            .find(|scenario| scenario.probability > 0.0)
            .ok_or_else(|| "at least one scenario must have positive probability".to_string())?;

        for scenario in scenarios {
            cumulative += scenario.probability / total;
            if draw < cumulative {
                selected = scenario;
                break;
            }
        }
        samples.push(selected.impact);
    }

    samples.sort_by(f64::total_cmp);
    let expected_impact = scenarios
        .iter()
        .map(|scenario| scenario.probability * scenario.impact)
        .sum();
    let worst_case_impact = scenarios
        .iter()
        .filter(|scenario| scenario.probability > 0.0)
        .map(|scenario| scenario.impact)
        .fold(0.0, f64::max);
    let p95_index = (((samples.len() - 1) as f64) * 0.95).ceil() as usize;

    Ok(SimulationResult {
        iterations,
        expected_impact,
        worst_case_impact,
        p95_impact: samples[p95_index],
        budget_exhausted: requested > iterations,
        method: "BOUNDED_DETERMINISTIC_WEIGHTED_SAMPLING_NOT_CAUSAL".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scenarios() -> Vec<Scenario> {
        vec![
            Scenario {
                name: "normal".into(),
                probability: 0.8,
                impact: 2.0,
            },
            Scenario {
                name: "degraded".into(),
                probability: 0.2,
                impact: 10.0,
            },
        ]
    }

    #[test]
    fn budget_is_enforced() {
        let result = simulate(&scenarios(), 500, 20).unwrap();
        assert_eq!(result.iterations, 20);
        assert!(result.budget_exhausted);
        assert!((result.expected_impact - 3.6).abs() < 1e-9);
        assert_eq!(result.worst_case_impact, 10.0);
    }

    #[test]
    fn rejects_invalid_or_incomplete_probability_mass() {
        let invalid = vec![Scenario {
            name: "bad".into(),
            probability: 1.2,
            impact: 1.0,
        }];
        assert!(simulate(&invalid, 5, 5).is_err());

        let incomplete = vec![Scenario {
            name: "incomplete".into(),
            probability: 0.4,
            impact: 1.0,
        }];
        assert!(simulate(&incomplete, 5, 5).is_err());
    }

    #[test]
    fn zero_probability_scenarios_do_not_inflate_worst_case() {
        let scenarios = vec![
            Scenario {
                name: "possible".into(),
                probability: 1.0,
                impact: 4.0,
            },
            Scenario {
                name: "impossible".into(),
                probability: 0.0,
                impact: 999.0,
            },
        ];
        let result = simulate(&scenarios, 10, 10).unwrap();
        assert_eq!(result.worst_case_impact, 4.0);
        assert_eq!(result.p95_impact, 4.0);
    }

    #[test]
    fn rejects_blank_scenario_names() {
        let scenarios = vec![Scenario {
            name: " ".into(),
            probability: 1.0,
            impact: 1.0,
        }];
        assert!(simulate(&scenarios, 5, 5).is_err());
    }
}
