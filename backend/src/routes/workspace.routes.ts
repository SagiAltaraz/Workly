import { Router } from 'express'
import { createWorkspace, getWorkspace } from '../controllers/workspace.controller'

const router = Router()

router.post('/', createWorkspace)
router.get('/:id', getWorkspace)

export default router
