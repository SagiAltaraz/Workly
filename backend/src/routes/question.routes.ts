import { Router } from 'express'
import { hideQuestion, resolveOpenContradiction } from '../controllers/question.controller'

const router = Router({ mergeParams: true })

router.post('/questions/:questionId/dismiss', hideQuestion)
router.post('/contradictions/:contradictionId/resolve', resolveOpenContradiction)

export default router
