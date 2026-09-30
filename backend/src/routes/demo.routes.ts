import { Router } from 'express'
import { loadDemoWorkspace } from '../controllers/demo.controller'

const router = Router()

router.post('/', loadDemoWorkspace)

export default router
