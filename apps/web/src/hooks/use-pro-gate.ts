import { useProfileStore } from "@synq/shared"

export function useProGate() {
  const isPro = useProfileStore(s => s.isPro)
  const planTier = useProfileStore(s => s.planTier)
  const isAdmin = useProfileStore(s => s.isAdmin)
  return {
    isPro,
    isFree: planTier === 'free' && !isAdmin,
    planTier,
    isAdmin,
  }
}
