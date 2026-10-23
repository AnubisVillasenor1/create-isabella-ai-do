use uuid::Uuid;
use worldmodel::{CausalEdge, Entity, Relation, WorldGraph};

fn entity(name: &str) -> Entity {
    Entity {
        entity_id: Uuid::now_v7(),
        name: name.into(),
        entity_type: "test".into(),
        provenance: "test fixture".into(),
    }
}

#[test]
fn rejects_dangling_relation() {
    let mut graph = WorldGraph::new();
    let source = entity("source");
    graph.add_entity(source.clone());
    assert!(graph
        .add_relation(Relation {
            source: source.entity_id,
            target: Uuid::now_v7(),
            relation: "links".into(),
            confidence: 0.8,
        })
        .is_err());
}

#[test]
fn rejects_non_finite_confidence() {
    let mut graph = WorldGraph::new();
    let source = entity("source");
    let target = entity("target");
    graph.add_entity(source.clone());
    graph.add_entity(target.clone());
    assert!(graph
        .add_relation(Relation {
            source: source.entity_id,
            target: target.entity_id,
            relation: "links".into(),
            confidence: f32::NAN,
        })
        .is_err());
}

#[test]
fn connected_component_stays_with_reachable_entities() {
    let mut graph = WorldGraph::new();
    let a = entity("a");
    let b = entity("b");
    let c = entity("c");
    graph.add_entity(a.clone());
    graph.add_entity(b.clone());
    graph.add_entity(c.clone());
    graph
        .add_relation(Relation {
            source: a.entity_id,
            target: b.entity_id,
            relation: "connected".into(),
            confidence: 1.0,
        })
        .unwrap();
    let component = graph.connected_component(&a.entity_id);
    assert!(component.contains(&a.entity_id));
    assert!(component.contains(&b.entity_id));
    assert!(!component.contains(&c.entity_id));
}

#[test]
fn rejects_invalid_causal_probability() {
    let mut graph = WorldGraph::new();
    let cause = entity("cause");
    let effect = entity("effect");
    graph.add_entity(cause.clone());
    graph.add_entity(effect.clone());
    assert!(graph
        .add_causal_edge(CausalEdge {
            cause: cause.entity_id,
            effect: effect.entity_id,
            probability: f32::NAN,
            evidence: vec!["source".into()],
        })
        .is_err());
}
