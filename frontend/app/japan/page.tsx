import { JapanClient } from './JapanClient'
import { JAPAN_CENTER } from '@/lib/locations/japan'

export default function JapanPage() {
  return <JapanClient center={JAPAN_CENTER} />
}
