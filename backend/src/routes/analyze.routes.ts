import { Router } from 'express'
import { analyzeText } from '../controllers/analyze.controller'

const router = Router({ mergeParams: true })

router.post('/', analyzeText)

export default router
