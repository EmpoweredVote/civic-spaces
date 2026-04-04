import { Router, Request, Response } from 'express'
import { fetchAccountData } from '../services/accountsApi'
import { assignUserToSlices, upsertConnectedProfile, assignUnifiedIfNotAssigned, assignVolunteerIfEligible } from '../services/sliceAssigner'

const router = Router()

router.post('/assign', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId
    const rawToken = req.rawToken

    if (!userId || !rawToken) {
      res.status(401).json({ error: 'Missing authentication context' })
      return
    }

    const accountData = await fetchAccountData(rawToken)

    if (accountData.tier === 'inform') {
      res.status(403).json({ error: 'Connected tier required' })
      return
    }

    await upsertConnectedProfile(
      accountData.id,
      accountData.display_name,
      accountData.account_standing
    )

    const assigned: string[] = []

    // Unified: auto-assign all Connected users (check-before-insert — stable cohort)
    const unifiedSliceId = await assignUnifiedIfNotAssigned(accountData.id)
    if (unifiedSliceId) {
      assigned.push(unifiedSliceId)
    }

    // Volunteer: role-gated assignment (stub: always false in Phase 7)
    const volunteerSliceId = await assignVolunteerIfEligible(accountData.id, accountData)
    if (volunteerSliceId) {
      assigned.push(volunteerSliceId)
    }

    // Geo: assignment based on jurisdiction (4 geographic slices)
    if (accountData.jurisdiction !== null) {
      const geoResult = await assignUserToSlices(accountData.id, accountData.jurisdiction)
      assigned.push(...geoResult.assigned)
    }

    if (assigned.length === 0) {
      res.status(200).json({
        status: 'no_jurisdiction',
        message: 'User has no jurisdiction set',
      })
      return
    }

    res.status(200).json({ status: 'assigned', assigned })
  } catch (err) {
    console.error('Assignment error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
