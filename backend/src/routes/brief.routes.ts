import { Router } from 'express'
import {
  acceptSuggestion,
  answerDetail,
  createBriefItem,
  removeBriefItem,
  reviveBriefItem,
  updateBriefField,
  updateBriefItem,
} from '../controllers/brief.controller'

const router = Router({ mergeParams: true })

router.patch('/fields/:key', updateBriefField)
router.post('/items', createBriefItem)
router.patch('/items/:itemId', updateBriefItem)
router.delete('/items/:itemId', removeBriefItem)
router.post('/items/:itemId/restore', reviveBriefItem)
router.post('/items/:itemId/promote', acceptSuggestion)
router.post('/items/:itemId/answer', answerDetail)

export default router
