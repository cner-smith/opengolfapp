import { Linking } from 'react-native'

export const WEB_URL = 'https://oga.golf'

// Import parses Golf Pad and scorecard CSV files, which only the web app
// reads; the app sends the player there in the browser.
export function openWebImport() {
  return Linking.openURL(`${WEB_URL}/rounds/import`)
}
