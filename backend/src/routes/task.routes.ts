import { Router } from 'express'
import { createTask, removeTask, reviveTask, updateTask } from '../controllers/task.controller'

const router = Router({ mergeParams: true })

router.post('/', createTask)
router.patch('/:taskId', updateTask)
router.delete('/:taskId', removeTask)
router.post('/:taskId/restore', reviveTask)

export default router
