import { Router, Request, Response } from 'express'
import { fetchAccountData } from '../services/accountsApi'
import { assignUserToSlices, upsertConnectedProfile } from '../services/sliceAssigner'

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

    if (accountData.jurisdiction === null) {
      res.status(200).json({
        status: 'no_jurisdiction',
        message: 'User has no jurisdiction set',
      })
      return
    }

    const result = await assignUserToSlices(accountData.id, accountData.jurisdiction)

    res.status(200).json({ status: 'assigned', assigned: result.assigned })
  } catch (err) {
    console.error('Assignment error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
