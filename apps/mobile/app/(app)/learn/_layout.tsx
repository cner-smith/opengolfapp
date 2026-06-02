import { Stack } from 'expo-router'

// Learn is its own stack so index → [article] is a real push: pressing
// "← Back" in an article pops to the list instead of falling through to
// the Home tab (which is what happened when the two screens were flat
// sibling routes of the Tabs navigator). Screens render their own AppBar,
// so the stack header stays hidden.
export default function LearnLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
