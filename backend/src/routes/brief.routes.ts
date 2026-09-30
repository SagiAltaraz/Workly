import { Router } from 'express'
import {
  acceptSuggestion,
  answerDetail,
  createBrief,
  createBriefItem,
  removeBriefItem,
  reviveBriefItem,
  updateBriefField,
  updateBriefItem,
} from '../controllers/brief.controller'

const router = Router({ mergeParams: true })

router.post('/', createBrief)
// No briefId: starts a brand new brief with this as its first item (the empty state's own buttons).
router.post('/items', createBriefItem)
// Item routes address the item by its own (globally unique) id, so they need no briefId.
router.patch('/items/:itemId', updateBriefItem)
router.delete('/items/:itemId', removeBriefItem)
router.post('/items/:itemId/restore', reviveBriefItem)
router.post('/items/:itemId/promote', acceptSuggestion)
router.post('/items/:itemId/answer', answerDetail)
// With a briefId: fields and items of one specific, already-existing brief.
router.patch('/:briefId/fields/:key', updateBriefField)
router.post('/:briefId/items', createBriefItem)

export default router
