use shared::CognitiveEvent;
use tokio::sync::broadcast;
#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<CognitiveEvent>,
}
impl EventBus {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity.max(1));
        Self { sender }
    }
    pub fn publish(&self, event: CognitiveEvent) -> usize {
        self.sender.send(event).unwrap_or(0)
    }
    pub fn subscribe(&self) -> broadcast::Receiver<CognitiveEvent> {
        self.sender.subscribe()
    }
}
