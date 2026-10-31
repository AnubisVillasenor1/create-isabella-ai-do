use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub entity_id: Uuid,
    pub name: String,
    pub entity_type: String,
    pub provenance: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relation {
    pub source: Uuid,
    pub target: Uuid,
    pub relation: String,
    pub confidence: f32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CausalEdge {
    pub cause: Uuid,
    pub effect: Uuid,
    pub probability: f32,
    pub evidence: Vec<String>,
}
#[derive(Debug, Default)]
pub struct WorldGraph {
    entities: HashMap<Uuid, Entity>,
    relations: Vec<Relation>,
    causal_edges: Vec<CausalEdge>,
}
impl WorldGraph {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn add_entity(&mut self, e: Entity) {
        self.entities.insert(e.entity_id, e);
    }
    pub fn add_relation(&mut self, r: Relation) -> Result<(), &'static str> {
        if !self.entities.contains_key(&r.source) || !self.entities.contains_key(&r.target) {
            return Err("relation endpoints must exist");
        }
        if !r.confidence.is_finite() || !(0.0..=1.0).contains(&r.confidence) {
            return Err("confidence must be [0,1]");
        }
        self.relations.push(r);
        Ok(())
    }
    pub fn add_causal_edge(&mut self, e: CausalEdge) -> Result<(), &'static str> {
        if !self.entities.contains_key(&e.cause) || !self.entities.contains_key(&e.effect) {
            return Err("causal endpoints must exist");
        }
        if !e.probability.is_finite() || !(0.0..=1.0).contains(&e.probability) {
            return Err("probability must be [0,1]");
        }
        self.causal_edges.push(e);
        Ok(())
    }
    pub fn entity(&self, id: &Uuid) -> Option<&Entity> {
        self.entities.get(id)
    }
    pub fn causes_of(&self, id: &Uuid) -> Vec<&CausalEdge> {
        self.causal_edges
            .iter()
            .filter(|e| &e.effect == id)
            .collect()
    }
    pub fn connected_component(&self, start: &Uuid) -> HashSet<Uuid> {
        if !self.entities.contains_key(start) {
            return HashSet::new();
        }
        let mut seen = HashSet::new();
        let mut stack = vec![*start];
        while let Some(id) = stack.pop() {
            if !seen.insert(id) {
                continue;
            }
            for r in &self.relations {
                if r.source == id {
                    stack.push(r.target)
                } else if r.target == id {
                    stack.push(r.source)
                }
            }
        }
        seen
    }
}
