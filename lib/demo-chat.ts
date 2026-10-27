export function createDemoReply(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes("remember")) {
    return "I can help you keep that in mind during this demo. Saved memories aren't connected yet, so nothing will persist after you leave."
  }
  if (normalized.includes("hello") || normalized.includes("hi")) {
    return "Hi, it's lovely to have you here. What would feel helpful right now?"
  }
  return "Thanks for sharing that with me. I'm here to help you think it through. This is a sample response in the local demo."
}
