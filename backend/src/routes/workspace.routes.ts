import { Router } from 'express'
import { createWorkspace, getWorkspace, undoLastChange, updateCardOrder } from '../controllers/workspace.controller'
import analyzeRoutes from './analyze.routes'
import briefRoutes from './brief.routes'
import commandRoutes from './command.routes'
import meetingRoutes from './meeting.routes'
import questionRoutes from './question.routes'
import taskRoutes from './task.routes'

const router = Router()

router.post('/', createWorkspace)
router.get('/:id', getWorkspace)
router.post('/:id/undo', undoLastChange)
router.put('/:id/order', updateCardOrder)
router.use('/:id/analyze', analyzeRoutes)
router.use('/:id/tasks', taskRoutes)
router.use('/:id/meetings', meetingRoutes)
router.use('/:id/brief', briefRoutes)
router.use('/:id/commands', commandRoutes)
router.use('/:id', questionRoutes)

export default router
