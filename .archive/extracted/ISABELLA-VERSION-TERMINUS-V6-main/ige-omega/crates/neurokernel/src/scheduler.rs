use shared::CognitiveEvent;
use std::collections::VecDeque;
#[derive(Debug, Default)]
pub struct Scheduler {
    queue: VecDeque<CognitiveEvent>,
    capacity: usize,
}
impl Scheduler {
    pub fn new(capacity: usize) -> Self {
        Self {
            queue: VecDeque::new(),
            capacity: capacity.max(1),
        }
    }
    pub fn enqueue(&mut self, event: CognitiveEvent) -> Result<(), CognitiveEvent> {
        if self.queue.len() >= self.capacity {
            return Err(event);
        }
        self.queue.push_back(event);
        Ok(())
    }
    pub fn dequeue(&mut self) -> Option<CognitiveEvent> {
        self.queue.pop_front()
    }
    pub fn len(&self) -> usize {
        self.queue.len()
    }
    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}
