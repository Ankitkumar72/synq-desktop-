import { useProfileStore } from '@/lib/store/use-profile-store'

/**
 * Convenience hook for feature gating.
 * Usage: const { isPro, isFree } = useProGate()
 */
export function useProGate() {
  const { isPro, planTier, isAdmin } = useProfileStore()
  return {
    isPro,
    isFree: planTier === 'free' && !isAdmin,
    planTier,
    isAdmin,
  }
}
