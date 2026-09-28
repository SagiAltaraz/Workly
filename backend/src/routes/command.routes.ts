import { Router } from 'express'
import { executeChosenCommand } from '../controllers/command.controller'

const router = Router({ mergeParams: true })

router.post('/execute', executeChosenCommand)

export default router
